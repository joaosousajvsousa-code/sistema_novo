import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { getActiveCamp, campEditable } from '@/lib/camp';
import { PageHeader, Panel } from '@/components/ui/layout';
import { TeamForm } from '../TeamForm';

export const metadata: Metadata = { title: 'Nova equipe' };

export default async function NovaEquipePage() {
  await requirePerm('equipes.gerenciar');
  const camp = await getActiveCamp();
  if (!campEditable(camp)) redirect('/equipes');
  return (
    <>
      <PageHeader title="Nova equipe" back={{ href: '/equipes', label: 'Equipes' }} />
      <Panel>
        <TeamForm />
      </Panel>
    </>
  );
}
