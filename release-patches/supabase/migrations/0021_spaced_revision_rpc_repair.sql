-- Idempotent repair for Phase 3R spaced revision. Preserves learner data and roles.
create table if not exists public.wrong_question_bookmarks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 exam_id uuid not null references public.exams(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 wrong_count integer not null default 1,
 last_wrong_at timestamptz not null default now(),
 next_review_at date not null default current_date + 1,
 mastered boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id, question_id)
);
create index if not exists wrong_book_user_review_idx on public.wrong_question_bookmarks(user_id,next_review_at) where mastered=false;
alter table public.wrong_question_bookmarks
 add column if not exists review_interval_days integer not null default 1,
 add column if not exists ease_factor numeric(4,2) not null default 2.50,
 add column if not exists successful_reviews integer not null default 0,
 add column if not exists last_reviewed_at timestamptz,
 add column if not exists last_recall_rating text;
alter table public.wrong_question_bookmarks enable row level security;
drop policy if exists "students manage own wrong notebook" on public.wrong_question_bookmarks;
create policy "students manage own wrong notebook" on public.wrong_question_bookmarks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.revision_review_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 exam_id uuid not null references public.exams(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 recall_rating text not null check(recall_rating in ('again','hard','good','easy')),
 interval_days integer not null,
 reviewed_at timestamptz not null default now()
);
create index if not exists revision_history_user_date_idx on public.revision_review_history(user_id,reviewed_at desc);
alter table public.revision_review_history enable row level security;
drop policy if exists "students read own revision history" on public.revision_review_history;
create policy "students read own revision history" on public.revision_review_history for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.revision_review_history from anon,authenticated;

create or replace function public.get_my_revision_queue(p_exam_id uuid,p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_data jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_exam_id is null then raise exception 'Exam is required'; end if;
 with due_items as (
  select q.id,q.question_hi,q.question_en,e.explanation_hi,e.explanation_en,
         w.wrong_count,w.next_review_at,w.review_interval_days,w.successful_reviews
  from public.wrong_question_bookmarks w
  join public.questions q on q.id=w.question_id
  left join public.question_explanations e on e.question_id=q.id
  where w.user_id=v_user and w.exam_id=p_exam_id and w.mastered=false
    and w.next_review_at<=current_date and q.status='published'
  order by w.next_review_at,w.wrong_count desc
  limit greatest(1,least(coalesce(p_limit,30),100))
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'question_id',id,'question_hi',question_hi,'question_en',question_en,
  'explanation_hi',explanation_hi,'explanation_en',explanation_en,
  'wrong_count',wrong_count,'next_review_at',next_review_at,
  'review_interval_days',review_interval_days,'successful_reviews',successful_reviews
 )), '[]'::jsonb) into v_data from due_items;
 return jsonb_build_object('items',v_data,'due_count',jsonb_array_length(v_data));
end; $$;

create or replace function public.submit_my_revision_review(p_exam_id uuid,p_question_id uuid,p_rating text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_interval integer; v_mastered boolean:=false;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_exam_id is null or p_question_id is null then raise exception 'Exam and question are required'; end if;
 if p_rating not in ('again','hard','good','easy') then raise exception 'Invalid recall rating'; end if;
 update public.wrong_question_bookmarks w set
  review_interval_days=case p_rating
   when 'again' then 1 when 'hard' then greatest(1,ceil(w.review_interval_days*1.2)::int)
   when 'good' then case when w.successful_reviews=0 then 2 else greatest(2,ceil(w.review_interval_days*w.ease_factor)::int) end
   when 'easy' then greatest(4,ceil(w.review_interval_days*(w.ease_factor+0.5))::int) end,
  ease_factor=greatest(1.30,least(3.00,w.ease_factor+case p_rating when 'again' then -0.20 when 'hard' then -0.10 when 'easy' then 0.15 else 0.05 end)),
  successful_reviews=case when p_rating='again' then 0 else w.successful_reviews+1 end,
  last_reviewed_at=now(),last_recall_rating=p_rating,
  next_review_at=current_date+case p_rating
   when 'again' then 1 when 'hard' then greatest(1,ceil(w.review_interval_days*1.2)::int)
   when 'good' then case when w.successful_reviews=0 then 2 else greatest(2,ceil(w.review_interval_days*w.ease_factor)::int) end
   when 'easy' then greatest(4,ceil(w.review_interval_days*(w.ease_factor+0.5))::int) end,
  mastered=case when p_rating='again' then false else w.successful_reviews+1>=5 end
 where w.user_id=v_user and w.exam_id=p_exam_id and w.question_id=p_question_id and w.mastered=false
 returning w.review_interval_days,w.mastered into v_interval,v_mastered;
 if not found then raise exception 'Revision item not found'; end if;
 insert into public.revision_review_history(user_id,exam_id,question_id,recall_rating,interval_days)
 values(v_user,p_exam_id,p_question_id,p_rating,v_interval);
 return jsonb_build_object('next_review_days',v_interval,'mastered',v_mastered);
end; $$;
revoke all on function public.get_my_revision_queue(uuid,integer) from public;
revoke all on function public.submit_my_revision_review(uuid,uuid,text) from public;
grant execute on function public.get_my_revision_queue(uuid,integer) to authenticated;
grant execute on function public.submit_my_revision_review(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
