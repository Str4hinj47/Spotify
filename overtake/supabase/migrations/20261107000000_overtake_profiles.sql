-- Optional, isolated account foundation. Apply only to an intended OVERTAKE project
-- after reviewing its existing schema and enabling Supabase Auth. No score writes.
create table if not exists public.overtake_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 32),
  created_at timestamptz not null default now()
);
alter table public.overtake_profiles enable row level security;
revoke all on public.overtake_profiles from anon, authenticated;
grant select on public.overtake_profiles to authenticated;
grant insert (user_id, display_name) on public.overtake_profiles to authenticated;
grant update (display_name) on public.overtake_profiles to authenticated;
create policy "overtake_profiles_read_own" on public.overtake_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "overtake_profiles_insert_own" on public.overtake_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "overtake_profiles_update_own" on public.overtake_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
