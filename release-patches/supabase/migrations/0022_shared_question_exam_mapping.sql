-- Share one canonical question across multiple exams/courses without duplicating its content.
create table if not exists public.question_exam_mappings (
  question_id uuid not null references public.questions(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (question_id, exam_id)
);
create index if not exists question_exam_mappings_exam_idx
  on public.question_exam_mappings(exam_id, question_id);
alter table public.question_exam_mappings enable row level security;
drop policy if exists "content staff manage shared question mappings" on public.question_exam_mappings;
create policy "content staff manage shared question mappings"
  on public.question_exam_mappings for all to authenticated
  using (public.can_manage_content())
  with check (public.can_manage_content());
grant select, insert, update, delete on public.question_exam_mappings to authenticated;

-- Student-safe question feed: answer keys are never returned by this function.
create or replace function public.get_published_exam_questions(p_exam_id uuid)
returns table (
  id uuid,
  subject_id uuid,
  topic_id uuid,
  difficulty text,
  question_hi text,
  question_en text,
  marks numeric,
  negative_marks numeric,
  question_options jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select q.id, q.subject_id, q.topic_id, q.difficulty::text, q.question_hi, q.question_en,
         q.marks, q.negative_marks,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', o.id, 'option_key', o.option_key, 'text_hi', o.text_hi,
             'text_en', o.text_en, 'display_order', o.display_order
           ) order by o.display_order)
           from public.question_options o where o.question_id = q.id
         ), '[]'::jsonb) as question_options
  from public.questions q
  where q.status = 'published'
    and (
      q.exam_id = p_exam_id
      or exists (
        select 1 from public.question_exam_mappings m
        where m.question_id = q.id and m.exam_id = p_exam_id
      )
    );
end;
$$;
revoke all on function public.get_published_exam_questions(uuid) from public;
grant execute on function public.get_published_exam_questions(uuid) to authenticated;

-- Keep answer validation/scoring server-side while allowing mapped courses to use the same question.
create or replace function public.submit_test_attempt(
  p_exam_id uuid,
  p_answers jsonb,
  p_mode text default 'practice'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
  v_item jsonb;
  v_qid uuid;
  v_oid uuid;
  v_correct_option uuid;
  v_marks numeric(10,2);
  v_negative numeric(10,2);
  v_is_correct boolean;
  v_awarded numeric(10,2);
  v_total int := 0;
  v_attempted int := 0;
  v_correct int := 0;
  v_wrong int := 0;
  v_score numeric(10,2) := 0;
  v_max numeric(10,2) := 0;
  v_details jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('practice','mock') then raise exception 'Invalid attempt mode'; end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Answers must be a non-empty JSON array';
  end if;
  if jsonb_array_length(p_answers) > 300 then raise exception 'Maximum 300 questions per attempt'; end if;

  insert into public.test_attempts(user_id, exam_id, attempt_mode, total_questions)
  values(auth.uid(), p_exam_id, p_mode, jsonb_array_length(p_answers))
  returning id into v_attempt_id;

  for v_item in select value from jsonb_array_elements(p_answers)
  loop
    v_qid := (v_item->>'question_id')::uuid;
    v_oid := nullif(v_item->>'option_id','')::uuid;
    select a.correct_option_id, q.marks, q.negative_marks
      into v_correct_option, v_marks, v_negative
    from public.questions q
    join public.question_answers a on a.question_id = q.id
    where q.id = v_qid and q.status = 'published'
      and (
        q.exam_id = p_exam_id
        or exists (
          select 1 from public.question_exam_mappings m
          where m.question_id = q.id and m.exam_id = p_exam_id
        )
      );
    if not found then raise exception 'Question is unavailable or not published for this exam'; end if;
    if v_oid is not null and not exists(
      select 1 from public.question_options o where o.id = v_oid and o.question_id = v_qid
    ) then raise exception 'Selected option does not belong to question'; end if;

    v_total := v_total + 1;
    v_max := v_max + v_marks;
    v_is_correct := v_oid is not null and v_oid = v_correct_option;
    if v_oid is not null then v_attempted := v_attempted + 1; end if;
    if v_is_correct then
      v_correct := v_correct + 1; v_awarded := v_marks;
    elsif v_oid is not null then
      v_wrong := v_wrong + 1; v_awarded := -v_negative;
    else
      v_awarded := 0;
    end if;
    v_score := v_score + v_awarded;

    insert into public.test_attempt_responses(attempt_id, question_id, selected_option_id, is_correct, marks_awarded)
    values(v_attempt_id, v_qid, v_oid, v_is_correct, v_awarded);

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'question_id', v_qid,
      'selected_option_id', v_oid,
      'correct_option_id', v_correct_option,
      'is_correct', v_is_correct,
      'marks_awarded', v_awarded,
      'explanation_hi', (select explanation_hi from public.question_explanations where question_id = v_qid),
      'explanation_en', (select explanation_en from public.question_explanations where question_id = v_qid)
    ));
  end loop;

  update public.test_attempts set
    submitted_at = now(), total_questions = v_total, attempted_questions = v_attempted,
    correct_answers = v_correct, wrong_answers = v_wrong, unanswered = v_total - v_attempted,
    score = v_score, max_score = v_max, status = 'submitted'
  where id = v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id, 'total_questions', v_total,
    'attempted_questions', v_attempted, 'correct_answers', v_correct,
    'wrong_answers', v_wrong, 'unanswered', v_total - v_attempted,
    'score', v_score, 'max_score', v_max, 'details', v_details
  );
end;
$$;
revoke all on function public.submit_test_attempt(uuid,jsonb,text) from public;
grant execute on function public.submit_test_attempt(uuid,jsonb,text) to authenticated;
