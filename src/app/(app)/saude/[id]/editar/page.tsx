import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canManageMeds, hhmm } from '@/lib/meds';
import { loadRecrutaOptions } from '@/lib/meds-data';
import { PageHeader, Panel } from '@/components/ui/layout';
import { PlanForm } from '../../PlanForm';

export const metadata: Metadata = { title: 'Editar remédio' };

export default async function EditarRemedioPage({ params }: { params: { id: string } }) {
  await requireCheck(canManageMeds);
  const { data: p } = await createClient()
    .from('medication_plans')
    .select('id, camp_id, encontrista_id, medication, dose, times, start_date, end_date, instructions')
    .eq('id', params.id)
    .maybeSingle();
  if (!p) notFound();
  const recrutas = await loadRecrutaOptions(p.camp_id);
  return (
    <>
      <PageHeader title="Editar remédio" back={{ href: '/saude', label: 'Saúde' }} />
      <Panel>
        <PlanForm plan={{ ...p, times: (p.times as string[]).map(hhmm).join(', ') }} recrutas={recrutas} />
      </Panel>
    </>
  );
}
