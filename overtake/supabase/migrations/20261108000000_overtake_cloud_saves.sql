-- Optional. Review the project and existing schema first; not automatically applied.
-- This table is for user-controlled, unverified convenience backups, NEVER rankings.
create table public.overtake_cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_id uuid not null unique default gen_random_uuid(),
  revision integer not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 131072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.overtake_cloud_saves enable row level security;
revoke all on public.overtake_cloud_saves from public, anon, authenticated;
grant select, delete on public.overtake_cloud_saves to authenticated;
grant insert (user_id, payload) on public.overtake_cloud_saves to authenticated;
grant update (payload) on public.overtake_cloud_saves to authenticated;
create policy "overtake_cloud_select_own" on public.overtake_cloud_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "overtake_cloud_insert_own" on public.overtake_cloud_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "overtake_cloud_update_own" on public.overtake_cloud_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "overtake_cloud_delete_own" on public.overtake_cloud_saves for delete to authenticated using ((select auth.uid()) = user_id);

-- Revision and timestamp are server controlled. Clients condition updates/deletes
-- on the save ID and revision they read, to avoid accidental concurrent overwrites
-- even if another device deletes and recreates the row.
create function public.overtake_cloud_save_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger overtake_cloud_save_before_update before update on public.overtake_cloud_saves
for each row execute function public.overtake_cloud_save_before_update();
