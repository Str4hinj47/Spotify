-- Weekly board, server-verified score submission, cloud garage snapshots.
create or replace function public.leaderboard_weekly(p_mode text, p_limit int default 20)
returns table(rank bigint, display_name text, score int, mode text, car_id text, created_at timestamptz)
language sql stable as $$
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.car_id, s.created_at
    from public.scores s
    where s.mode = p_mode and s.created_at >= date_trunc('week', now())
    order by s.user_id, s.score desc, s.created_at asc
  )
  select row_number() over (order by b.score desc, b.created_at asc), p.display_name, b.score, p_mode, b.car_id, b.created_at
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc limit greatest(1, least(p_limit, 100));
$$;
grant execute on function public.leaderboard_weekly(text, int) to anon, authenticated;

create or replace function public.submit_score(
  p_mode text, p_car text, p_score int, p_distance int, p_overtakes int,
  p_near int, p_top_speed int, p_contracts int, p_elapsed int, p_medal text, p_seed bigint
) returns bigint language plpgsql security invoker as $$
declare v_id bigint; v_verified boolean;
begin
  if auth.uid() is null then raise exception 'signed in required'; end if;
  v_verified :=
    p_score <= (p_elapsed * 400 + 3000)
    and p_overtakes <= (p_elapsed * 2 + 20)
    and p_distance <= (p_elapsed * 95 + 500)
    and (p_mode <> 'daily' or p_seed is not null);
  insert into public.scores(user_id, mode, car_id, score, distance_m, overtakes, near_misses,
    top_speed_kmh, contracts_done, elapsed_s, medal, seed, build, is_verified)
  values (auth.uid(), p_mode, p_car, p_score, p_distance, p_overtakes, p_near,
    p_top_speed, p_contracts, p_elapsed, p_medal, p_seed, 'web-season01', v_verified)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_score(text,text,int,int,int,int,int,int,int,text,bigint) to authenticated;

alter table public.profiles add column if not exists cloud_save jsonb not null default '{}'::jsonb;
