import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel } from '@/components/ui/layout';
import { PasteForm } from './PasteForm';

export const metadata: Metadata = { title: 'Colar cronograma' };

export default async function ColarCronogramaPage() {
  await requirePerm('programacao.gerenciar');
  const camp = await getActiveCamp();
  if (!campEditable(camp)) redirect('/cronograma');
  return (
    <>
      <PageHeader
        title="Colar cronograma"
        description="Cole a lista de um dia inteiro. Antes de salvar, confira a prévia."
        back={{ href: '/cronograma', label: 'Cronograma' }}
      />
      <Panel>
        <PasteForm defaultDate={camp?.start_date ?? ''} />
      </Panel>
    </>
  );
}
