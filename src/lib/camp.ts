import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type ActiveCamp = {
  id: string;
  name: string;
  status: string;
  shirt_sizes: string[];
  signup_fields: { key: string; label: string; type: 'text' | 'select'; required: boolean; options: string[] }[];
};

export const getActiveCamp = cache(async (): Promise<ActiveCamp | null> => {
  const supabase = createClient();
  const { data } = await supabase.from('camps').select('id, name, status, shirt_sizes, signup_fields').eq('is_active', true).maybeSingle();
  return (data as ActiveCamp | null) ?? null;
});

export function campEditable(camp: ActiveCamp | null) {
  return Boolean(camp && !['encerrado', 'arquivado'].includes(camp.status));
}

export function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (env) return env;
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
