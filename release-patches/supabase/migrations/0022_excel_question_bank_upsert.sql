-- Excel-managed Question Bank: stable external references and atomic admin upsert.
alter table public.questions add column if not exists question_ref text;
create unique index if not exists questions_exam_subject_question_ref_uidx
  on public.questions (exam_id, subject_id, lower(question_ref))
  where question_ref is not null and btrim(question_ref) <> '';

create or replace function public.admin_upsert_question_from_excel(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_exam_id uuid; v_subject_id uuid; v_topic_id uuid;
  v_question_id uuid; v_option_id uuid; v_correct text; v_status text;
  v_ref text; v_opt jsonb; v_existing boolean:=false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.user_roles where user_id=v_uid
    and role in ('super_admin','content_admin','question_manager')) then
    raise exception 'Question manager permission required';
  end if;
  v_ref:=nullif(btrim(p_payload->>'question_ref'),'');
  if v_ref is null then raise exception 'question_ref is required'; end if;
  select id into v_exam_id from public.exams where upper(code)=upper(p_payload->>'exam_code') limit 1;
  select id into v_subject_id from public.subjects where upper(code)=upper(p_payload->>'subject_code') limit 1;
  if v_exam_id is null or v_subject_id is null then raise exception 'Unknown exam_code or subject_code'; end if;
  v_topic_id:=nullif(p_payload->>'topic_id','')::uuid;
  v_correct:=upper(p_payload->>'correct_option');
  if v_correct not in ('A','B','C','D') then raise exception 'correct_option must be A/B/C/D'; end if;

  select id,status into v_question_id,v_status from public.questions
    where exam_id=v_exam_id and subject_id=v_subject_id and lower(question_ref)=lower(v_ref) limit 1;
  v_existing:=v_question_id is not null;
  if not v_existing then
    insert into public.questions(exam_id,subject_id,topic_id,question_ref,question_hi,question_en,
      difficulty,marks,negative_marks,status,created_by)
    values(v_exam_id,v_subject_id,v_topic_id,v_ref,nullif(p_payload->>'question_hi',''),
      nullif(p_payload->>'question_en',''),coalesce(nullif(p_payload->>'difficulty',''),'moderate')::public.question_difficulty,
      coalesce(nullif(p_payload->>'marks','')::numeric,1),
      coalesce(nullif(p_payload->>'negative_marks','')::numeric,0),'draft',v_uid)
    returning id,status into v_question_id,v_status;
  else
    update public.questions set topic_id=v_topic_id,question_hi=nullif(p_payload->>'question_hi',''),
      question_en=nullif(p_payload->>'question_en',''),
      difficulty=coalesce(nullif(p_payload->>'difficulty','')::public.question_difficulty,difficulty),
      marks=coalesce(nullif(p_payload->>'marks','')::numeric,marks),
      negative_marks=coalesce(nullif(p_payload->>'negative_marks','')::numeric,negative_marks)
    where id=v_question_id;
  end if;

  delete from public.question_answers where question_id=v_question_id;
  delete from public.question_options where question_id=v_question_id;
  for v_opt in select value from jsonb_array_elements(coalesce(p_payload->'options','[]'::jsonb)) loop
    insert into public.question_options(question_id,option_key,text_hi,text_en,display_order)
    values(v_question_id,v_opt->>'option_key',nullif(v_opt->>'text_hi',''),nullif(v_opt->>'text_en',''),
      coalesce((v_opt->>'display_order')::integer,1)) returning id into v_option_id;
    if v_opt->>'option_key'=v_correct then
      insert into public.question_answers(question_id,correct_option_id) values(v_question_id,v_option_id);
    end if;
  end loop;
  insert into public.question_explanations(question_id,explanation_hi,explanation_en)
  values(v_question_id,nullif(p_payload->>'explanation_hi',''),nullif(p_payload->>'explanation_en',''))
  on conflict(question_id) do update set explanation_hi=excluded.explanation_hi,explanation_en=excluded.explanation_en;
  if nullif(p_payload->>'source_name','') is not null or nullif(p_payload->>'exam_year','') is not null then
    delete from public.question_sources where question_id=v_question_id;
    insert into public.question_sources(question_id,source_name,exam_year,is_verified)
    values(v_question_id,nullif(p_payload->>'source_name',''),nullif(p_payload->>'exam_year','')::integer,false);
  end if;
  return jsonb_build_object('question_id',v_question_id,'question_ref',v_ref,
    'action',case when v_existing then 'updated' else 'created' end,'status',coalesce(v_status,'draft'));
end; $$;
revoke all on function public.admin_upsert_question_from_excel(jsonb) from public;
grant execute on function public.admin_upsert_question_from_excel(jsonb) to authenticated;
notify pgrst,'reload schema';
