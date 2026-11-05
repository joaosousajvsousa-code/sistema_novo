import { createClient } from '@/lib/supabase/server';
import type { RecrutaOption } from '@/app/(app)/saude/PlanForm';

// Recrutas ativos para escolher no formulário de remédio.
export async function loadRecrutaOptions(campId: string): Promise<RecrutaOption[]> {
  const { data } = await createClient()
    .from('encontristas_list')
    .select('id, full_name, group_name')
    .eq('camp_id', campId)
    .eq('status', 'ativo')
    .order('name_normalized')
    .limit(2000);
  return (data ?? []) as RecrutaOption[];
}
