-- OVERTAKE Phase 1: profiles + scores + global leaderboards (Supabase/Postgres)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('endless','rush','daily')),
  car_id text not null check (char_length(car_id) between 2 and 32),
  score integer not null check (score >= 0 and score <= 500000),
  distance_m integer not null default 0 check (distance_m >= 0 and distance_m <= 500000),
  overtakes integer not null default 0 check (overtakes >= 0 and overtakes <= 2000),
  near_misses integer not null default 0 check (near_misses >= 0 and near_misses <= 2000),
  top_speed_kmh integer not null default 0 check (top_speed_kmh >= 0 and top_speed_kmh <= 450),
  contracts_done integer not null default 0 check (contracts_done between 0 and 3),
  elapsed_s integer not null default 0 check (elapsed_s >= 0 and elapsed_s <= 86400),
  medal text check (medal in ('bronze','silver','gold')),
  seed bigint,
  build text not null default 'web',
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scores_mode_score_idx on public.scores (mode, score desc);
create index if not exists scores_user_mode_idx on public.scores (user_id, mode, score desc);
create index if not exists scores_created_idx on public.scores (created_at desc);

alter table public.profiles enable row level security;
alter table public.scores enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "players insert own profile" on public.profiles;
create policy "players insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "players update own profile" on public.profiles;
create policy "players update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores for select using (true);
drop policy if exists "players submit own scores" on public.scores;
create policy "players submit own scores" on public.scores for insert with check (auth.uid() = user_id);

-- Auto-create a profile on sign-up (display name from sign-up metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), 'Driver ' || left(new.id::text, 6)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Leaderboard: best score per player in a mode, ranked.
create or replace function public.leaderboard(p_mode text, p_limit int default 20)
returns table(rank bigint, display_name text, score int, mode text, car_id text, created_at timestamptz)
language sql stable as $$
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.car_id, s.created_at
    from public.scores s where s.mode = p_mode order by s.user_id, s.score desc, s.created_at asc
  )
  select row_number() over (order by b.score desc, b.created_at asc), p.display_name, b.score, p_mode, b.car_id, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.leaderboard(text, int) to anon, authenticated;
