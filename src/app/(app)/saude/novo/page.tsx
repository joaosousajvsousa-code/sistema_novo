import type { Metadata } from 'next';
import { requireCheck } from '@/lib/auth';
import { getActiveCamp } from '@/lib/camp';
import { canManageMeds } from '@/lib/meds';
import { loadRecrutaOptions } from '@/lib/meds-data';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { PlanForm } from '../PlanForm';

export const metadata: Metadata = { title: 'Adicionar remédio' };

export default async function NovoRemedioPage({ searchParams }: { searchParams: { recruta?: string; salvo?: string } }) {
  await requireCheck(canManageMeds);
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const recrutas = await loadRecrutaOptions(camp.id);
  return (
    <>
      <PageHeader title="Adicionar remédio" back={{ href: '/saude', label: 'Saúde' }} />
      {searchParams.salvo ? (
        <Notice tone="ok" className="mb-5">
          Remédio adicionado. Cadastre o próximo.
        </Notice>
      ) : null}
      <Panel>
        <PlanForm key={searchParams.salvo ?? 'novo'} plan={{ encontrista_id: searchParams.recruta }} recrutas={recrutas} />
      </Panel>
    </>
  );
}
