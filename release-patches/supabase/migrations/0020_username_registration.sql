-- Username-only student registration support.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, phone, email, full_name, username)
  values (
    new.id, new.phone,
    case when new.email like '%@login.upteachermaster.invalid' then null else new.email end,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    nullif(lower(new.raw_user_meta_data->>'username'),'')
  )
  on conflict (id) do update set
    phone = excluded.phone, email = excluded.email,
    full_name = excluded.full_name,
    username = coalesce(excluded.username, public.profiles.username),
    updated_at = now();

  insert into public.user_roles(user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
