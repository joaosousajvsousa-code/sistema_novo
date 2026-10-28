import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { ItemForm } from '../CronogramaForms';

export const metadata: Metadata = { title: 'Adicionar momento' };

export default async function NovaAtividadePage({ searchParams }: { searchParams: { salvo?: string; dia?: string; inicio?: string } }) {
  await requirePerm('programacao.gerenciar');
  const camp = await getActiveCamp();
  if (!campEditable(camp)) redirect('/cronograma');
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.dia ?? '') ? searchParams.dia : camp?.start_date ?? '';
  const inicio = /^\d{2}:\d{2}$/.test(searchParams.inicio ?? '') ? searchParams.inicio : '';
  return (
    <>
      <PageHeader title="Adicionar momento" back={{ href: '/cronograma', label: 'Cronograma' }} />
      {searchParams.salvo ? (
        <Notice tone="ok" className="mb-5">
          Momento adicionado. O dia e o início já vêm preenchidos para o próximo.
        </Notice>
      ) : null}
      <Panel>
        <ItemForm key={searchParams.salvo ?? 'nova'} item={{ date: dia ?? '', start: inicio ?? '' }} />
      </Panel>
    </>
  );
}
