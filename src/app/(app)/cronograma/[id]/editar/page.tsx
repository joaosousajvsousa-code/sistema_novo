import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { formatTime, isoToLocalParts } from '@/lib/schedule';
import { DeleteItemForm, ItemForm } from '../../CronogramaForms';

export const metadata: Metadata = { title: 'Editar momento' };

export default async function EditarAtividadePage({ params }: { params: { id: string } }) {
  await requirePerm('programacao.gerenciar');
  const { data: i } = await createClient()
    .from('schedule_items')
    .select('id, title, description, location, responsible, planned_start, planned_end, original_start, original_end, status, notes')
    .eq('id', params.id)
    .maybeSingle();
  if (!i) notFound();
  const start = isoToLocalParts(i.original_start);
  const end = isoToLocalParts(i.original_end);
  const moved = i.planned_start !== i.original_start;
  return (
    <>
      <PageHeader title={`Editar ${i.title}`} back={{ href: '/cronograma', label: 'Cronograma' }} />
      {moved ? (
        <Notice tone="aviso" className="mb-5">
          Este momento foi ajustado ao vivo para {formatTime(i.planned_start)}. Salvar aqui define o horário oficial e desfaz esse ajuste.
        </Notice>
      ) : null}
      <div className="space-y-5">
        <Panel>
          <ItemForm
            item={{
              id: i.id,
              title: i.title,
              date: start.date,
              start: start.time,
              end: end.time,
              location: i.location,
              responsible: i.responsible,
              description: i.description,
              notes: i.notes,
            }}
          />
        </Panel>
        {i.status === 'agendada' ? (
          <Panel title="Excluir momento">
            <DeleteItemForm id={i.id} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
