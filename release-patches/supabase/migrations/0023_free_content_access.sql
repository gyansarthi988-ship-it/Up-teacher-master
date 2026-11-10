-- Free-only launch: all published study materials are available to authenticated students.
-- Admin/content staff retain access to drafts and management operations.
drop policy if exists "published materials visible by entitlement" on public.study_materials;
drop policy if exists "published materials visible" on public.study_materials;
create policy "published materials visible"
  on public.study_materials
  for select to authenticated
  using (
    public.can_manage_content()
    or status = 'published'
  );

-- Private files follow the same free-only rule as their published catalogue rows.
drop policy if exists "study material files readable by entitlement" on storage.objects;
drop policy if exists "content staff read study materials" on storage.objects;
create policy "study material files readable for all published"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'study-materials'
    and (
      public.can_manage_content()
      or exists (
        select 1
        from public.study_materials m
        where m.storage_path = storage.objects.name
          and m.status = 'published'
      )
    )
  );
