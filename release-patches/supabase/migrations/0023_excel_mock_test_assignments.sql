-- Excel-managed exact mock-test assignments; templates without assignments keep random selection.
alter table public.mock_test_templates add column if not exists mock_test_code text;
create unique index if not exists mock_test_templates_code_uidx on public.mock_test_templates(upper(mock_test_code)) where mock_test_code is not null and btrim(mock_test_code)<>'';
create table if not exists public.mock_test_template_questions(
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.mock_test_templates(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete restrict,
 question_order int not null check(question_order>0),
 marks_override numeric(7,2) check(marks_override is null or marks_override>0),
 negative_marks_override numeric(7,2) check(negative_marks_override is null or negative_marks_override>=0),
 created_at timestamptz not null default now(),
 unique(template_id,question_order), unique(template_id,question_id)
);
create index if not exists mock_test_template_questions_order_idx on public.mock_test_template_questions(template_id,question_order);
alter table public.mock_test_template_questions enable row level security;
create policy "assigned questions visible for active templates" on public.mock_test_template_questions for select to authenticated using(exists(select 1 from public.mock_test_templates t where t.id=template_id and (t.is_active or public.can_manage_content())));
create policy "content staff manage exact assignments" on public.mock_test_template_questions for all to authenticated using(public.can_manage_content()) with check(public.can_manage_content());

create or replace function public.admin_replace_mock_test_questions_from_excel(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 u uuid:=auth.uid(); ex uuid; tid uuid; sid uuid; qid uuid; r jsonb; n int:=0;
 code text:=nullif(btrim(p_payload->>'mock_test_code'),'');
begin
 if u is null or not exists(select 1 from public.user_roles where user_id=u and role in('super_admin','content_admin','question_manager','test_manager')) then raise exception 'Test manager permission required'; end if;
 if code is null then raise exception 'mock_test_code is required'; end if;
 select id into ex from public.exams where upper(code)=upper(p_payload->>'exam_code');
 if ex is null then raise exception 'Unknown exam_code'; end if;
 if jsonb_typeof(p_payload->'questions')<>'array' or jsonb_array_length(p_payload->'questions') not between 1 and 300 then raise exception 'Provide 1 to 300 assigned questions'; end if;
 select id into tid from public.mock_test_templates where upper(mock_test_code)=upper(code) for update;
 if tid is null then
  insert into public.mock_test_templates(exam_id,title_en,title_hi,duration_minutes,question_count,total_marks,default_marks,default_negative_marks,language_mode,question_selection,is_premium,is_active,created_by,mock_test_code)
  values(ex,coalesce(nullif(p_payload->>'mock_test_title_en',''),code),coalesce(nullif(p_payload->>'mock_test_title_hi',''),nullif(p_payload->>'mock_test_title_en',''),code),coalesce(nullif(p_payload->>'duration_minutes','')::int,60),jsonb_array_length(p_payload->'questions'),0,1,0,coalesce(nullif(p_payload->>'language_mode',''),'bilingual'), '{"strategy":"exact","published_only":true}',coalesce((p_payload->>'is_premium')::boolean,false),false,u,code) returning id into tid;
 else
  update public.mock_test_templates set exam_id=ex,title_en=coalesce(nullif(p_payload->>'mock_test_title_en',''),code),title_hi=coalesce(nullif(p_payload->>'mock_test_title_hi',''),nullif(p_payload->>'mock_test_title_en',''),code),duration_minutes=coalesce(nullif(p_payload->>'duration_minutes','')::int,60),question_count=jsonb_array_length(p_payload->'questions'),language_mode=coalesce(nullif(p_payload->>'language_mode',''),'bilingual'),question_selection='{"strategy":"exact","published_only":true}',is_premium=coalesce((p_payload->>'is_premium')::boolean,false),is_active=false where id=tid;
 end if;
 delete from public.mock_test_template_questions where template_id=tid;
 for r in select value from jsonb_array_elements(p_payload->'questions') loop
  select id into sid from public.subjects where upper(code)=upper(r->>'subject_code');
  select id into qid from public.questions where exam_id=ex and subject_id=sid and lower(question_ref)=lower(r->>'question_ref') and status='published';
  if sid is null or qid is null then raise exception 'Row %: question_ref % is missing, unpublished or mismatched',r->>'question_order',r->>'question_ref'; end if;
  insert into public.mock_test_template_questions(template_id,question_id,question_order,marks_override,negative_marks_override)
  values(tid,qid,(r->>'question_order')::int,nullif(r->>'marks_override','')::numeric,nullif(r->>'negative_marks_override','')::numeric);
  n:=n+1;
 end loop;
 return jsonb_build_object('template_id',tid,'mock_test_code',code,'assigned_questions',n,'status','inactive_until_admin_review');
end $$;
revoke all on function public.admin_replace_mock_test_questions_from_excel(jsonb) from public;
grant execute on function public.admin_replace_mock_test_questions_from_excel(jsonb) to authenticated;

-- Template-aware scoring: the existing 3-argument client call remains valid via default NULL.
alter table public.test_attempts add column if not exists template_id uuid references public.mock_test_templates(id) on delete set null;
drop function if exists public.submit_test_attempt(uuid,jsonb,text);
create or replace function public.submit_test_attempt(p_exam_id uuid,p_answers jsonb,p_mode text default 'practice',p_template_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 aid uuid; item jsonb; qid uuid; oid uuid; correct_id uuid; marks numeric; neg numeric; awarded numeric; ok boolean;
 total int:=0; attempted int:=0; correct int:=0; wrong int:=0; score numeric:=0; maxscore numeric:=0; details jsonb:='[]'::jsonb;
 ov record;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_mode not in('practice','mock') then raise exception 'Invalid attempt mode'; end if;
 if p_template_id is not null and not exists(select 1 from public.mock_test_templates where id=p_template_id and exam_id=p_exam_id and is_active) then raise exception 'Mock test template unavailable'; end if;
 if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers) not between 1 and 300 then raise exception 'Answers must contain 1 to 300 questions'; end if;
 insert into public.test_attempts(user_id,exam_id,attempt_mode,total_questions,template_id) values(auth.uid(),p_exam_id,p_mode,jsonb_array_length(p_answers),p_template_id) returning id into aid;
 for item in select value from jsonb_array_elements(p_answers) loop
  qid:=(item->>'question_id')::uuid; oid:=nullif(item->>'option_id','')::uuid;
  select a.correct_option_id,q.marks,q.negative_marks into correct_id,marks,neg from public.questions q join public.question_answers a on a.question_id=q.id where q.id=qid and q.exam_id=p_exam_id and q.status='published';
  if not found then raise exception 'Question unavailable or unpublished'; end if;
  if p_template_id is not null then
   select marks_override,negative_marks_override into ov from public.mock_test_template_questions where template_id=p_template_id and question_id=qid;
   if not found then raise exception 'Question is not assigned to this mock test'; end if;
   marks:=coalesce(ov.marks_override,marks); neg:=coalesce(ov.negative_marks_override,neg);
  end if;
  if oid is not null and not exists(select 1 from public.question_options where id=oid and question_id=qid) then raise exception 'Selected option does not belong to question'; end if;
  total:=total+1; maxscore:=maxscore+marks; ok:=oid is not null and oid=correct_id;
  if oid is not null then attempted:=attempted+1; end if;
  if ok then correct:=correct+1; awarded:=marks; elsif oid is not null then wrong:=wrong+1; awarded:=-neg; else awarded:=0; end if;
  score:=score+awarded;
  insert into public.test_attempt_responses(attempt_id,question_id,selected_option_id,is_correct,marks_awarded) values(aid,qid,oid,ok,awarded);
  details:=details||jsonb_build_array(jsonb_build_object('question_id',qid,'selected_option_id',oid,'correct_option_id',correct_id,'is_correct',ok,'marks_awarded',awarded,'explanation_hi',(select explanation_hi from public.question_explanations where question_id=qid),'explanation_en',(select explanation_en from public.question_explanations where question_id=qid)));
 end loop;
 if p_template_id is not null and total<>(select question_count from public.mock_test_templates where id=p_template_id) then raise exception 'Submitted question count does not match template'; end if;
 update public.test_attempts set submitted_at=now(),total_questions=total,attempted_questions=attempted,correct_answers=correct,wrong_answers=wrong,unanswered=total-attempted,score=score,max_score=maxscore,status='submitted' where id=aid;
 return jsonb_build_object('attempt_id',aid,'total_questions',total,'attempted_questions',attempted,'correct_answers',correct,'wrong_answers',wrong,'unanswered',total-attempted,'score',score,'max_score',maxscore,'details',details);
end $$;
revoke all on function public.submit_test_attempt(uuid,jsonb,text,uuid) from public;
grant execute on function public.submit_test_attempt(uuid,jsonb,text,uuid) to authenticated;
notify pgrst,'reload schema';
