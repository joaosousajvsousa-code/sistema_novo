import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export type ActiveCamp = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  shirt_sizes: string[];
  signup_fields: { key: string; label: string; type: 'text' | 'select'; required: boolean; options: string[] }[];
};

const CAMP_COLUMNS = 'id, name, status, start_date, end_date, shirt_sizes, signup_fields';

// O sistema trabalha com um acampamento só. Se ainda não existir, ele é
// criado automaticamente com valores padrão, para que as equipes possam ser
// montadas antes de os dados do evento estarem definidos (Configurações).
export const getActiveCamp = cache(async (): Promise<ActiveCamp | null> => {
  const supabase = createClient();
  const { data } = await supabase.from('camps').select(CAMP_COLUMNS).eq('is_active', true).maybeSingle();
  if (data) return data as ActiveCamp;
  if (!adminConfigured()) return null;

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;
  const admin = createAdminClient();
  const { data: existing } = await admin.from('camps').select(CAMP_COLUMNS).eq('is_active', true).maybeSingle();
  if (existing) return existing as ActiveCamp;
  const { data: created, error } = await admin
    .from('camps')
    .insert({ name: 'Acampamento', status: 'inscricoes_abertas', is_active: true })
    .select(CAMP_COLUMNS)
    .single();
  if (error) {
    // Outra pessoa pode ter criado no mesmo instante.
    const { data: again } = await admin.from('camps').select(CAMP_COLUMNS).eq('is_active', true).maybeSingle();
    return (again as ActiveCamp | null) ?? null;
  }
  return created as ActiveCamp;
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
