// OVERTAKE online layer — Supabase (Phase 1: accounts + global rankings).
// Only the publishable (anon) key ships in the client; Row Level Security in
// supabase/migrations/*_rankings.sql is the security boundary. Never put a
// secret/service_role key here.
import { createClient, type User } from '@supabase/supabase-js';
import type { RunMode } from './run.mjs';

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://ezvavdcntqjzcxpjyfku.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_Xl9xTmw15ERiDGXorK7K1A_9_T5ht1r';

export const supabase = createClient(url, anonKey);
export type OnlineUser = User;

export interface BoardRow {
  rank: number; display_name: string; score: number;
  mode: string; car_id: string; created_at: string;
}

export interface ScoreSubmission {
  mode: RunMode; car: string; score: number; distance: number;
  overtakes: number; nearMisses: number; topSpeed: number;
  contractsDone: number; elapsed: number; medal: string | null; seed?: number;
}

export async function currentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function onAuthChange(cb: (user: User | null) => void) {
  supabase.auth.getUser().then(({ data }) => cb(data.user));
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  if (data.user) {
    // Profile row is also created by the handle_new_user trigger; upsert covers both.
    await supabase.from('profiles').upsert({ id: data.user.id, display_name: displayName });
  }
  return data.user;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() { await supabase.auth.signOut(); }

/** Top scores: best run per player, per mode. Public read via RLS. */
export async function fetchLeaderboard(mode: RunMode = 'endless', limit = 20, weekly = false): Promise<BoardRow[]> {
  const { data, error } = weekly
    ? await supabase.rpc('leaderboard_weekly', { p_mode: mode, p_limit: limit })
    : await supabase.rpc('leaderboard', { p_mode: mode, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}

export async function myBest(mode: RunMode = 'endless'): Promise<number | null> {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('scores').select('score').eq('user_id', user.id).eq('mode', mode)
    .order('score', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.score ?? null;
}

/** Submit a finished run. Returns false (not throw) when signed out. */
export async function submitScore(s: ScoreSubmission): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  // Verified path: submit_score() applies plausibility checks server-side and
  // only marks the row is_verified when the run maths can be real.
  const { error } = await supabase.rpc('submit_score', {
    p_mode: s.mode, p_car: s.car, p_score: Math.round(s.score),
    p_distance: Math.round(s.distance), p_overtakes: s.overtakes,
    p_near: s.nearMisses, p_top_speed: Math.round(s.topSpeed),
    p_contracts: s.contractsDone, p_elapsed: Math.round(s.elapsed),
    p_medal: s.medal, p_seed: s.seed ?? null,
  });
  if (error) throw error;
  return true;
}

/** Cloud garage snapshot (progression/paints/customization JSON from localStorage). */
export async function saveCloudGarage(snapshot: Record<string, unknown>): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await supabase.from('profiles').update({ cloud_save: snapshot }).eq('id', user.id);
}

export async function loadCloudGarage(): Promise<Record<string, unknown> | null> {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('cloud_save').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return (data?.cloud_save as Record<string, unknown>) ?? null;
}
