import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type LeaderOption = { membership_id: string; full_name: string; phone: string | null; group_id: string | null; group_name: string | null; team_name: string };
export type GroupLeader = { group_id: string; membership_id: string; full_name: string; phone: string | null };

export async function loadAvailableLeaders(): Promise<LeaderOption[]> {
  const { data } = await createClient().rpc('available_leaders');
  return (data ?? []) as LeaderOption[];
}

export async function loadGroupLeaders(): Promise<Record<string, GroupLeader[]>> {
  const { data } = await createClient().rpc('group_leaders');
  const out: Record<string, GroupLeader[]> = {};
  for (const l of (data ?? []) as GroupLeader[]) (out[l.group_id] ??= []).push(l);
  return out;
}

export function leaderNames(list: GroupLeader[] | undefined) {
  return (list ?? []).map((l) => l.full_name).join(', ');
}
