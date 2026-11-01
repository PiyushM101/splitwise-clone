-- Add a username as the login handle, alongside email.
--
-- Email stays required and remains the real credential inside auth.users:
-- Supabase's signInWithPassword only accepts email or phone, so login resolves
-- username -> email via get_login_email() and then signs in with the email.
--
-- Usernames are nullable on purpose. Existing users are forced to pick one on
-- their next login (see /onboarding/username), so there is no backfill.

alter table public.profiles add column if not exists username text;

-- Case-insensitive uniqueness, ignoring the rows that have not picked one yet.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

-- 3-20 chars, starts with a letter, lowercase letters/digits/underscore.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,19}$');

-- Carry the username chosen at signup through to the profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Unknown'),
    nullif(lower(new.raw_user_meta_data->>'username'), '')
  );
  return new;
end;
$$;

-- Login lookup. Runs before the caller is authenticated, so it is callable by
-- anon. NOTE: this makes username -> email publicly resolvable. That is accepted
-- debt for now; making emails private means replacing this function with a
-- server route handler that uses the service-role key, since the browser needs
-- the email in hand to call signInWithPassword.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(p_username))
  limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;
