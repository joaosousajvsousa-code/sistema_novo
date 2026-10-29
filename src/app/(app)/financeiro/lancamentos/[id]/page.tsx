import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, Notice, DataList } from '@/components/ui/layout';
import { DocumentList } from '@/components/DocumentList';
import { listDocuments } from '@/lib/documents';
import { formatBRL } from '@/lib/money';
import { formatDate, formatDateTime, todayISO } from '@/lib/format';
import { AddDocumentForm, CancelEntryForm, EntryForm, type EntryData } from '../../FinanceForms';

export const metadata: Metadata = { title: 'Lançamento' };

export default async function LancamentoPage({ params, searchParams }: { params: { id: string }; searchParams: { aviso?: string } }) {
  await requirePerm('financeiro.gerenciar');
  const supabase = createClient();
  const { data: e } = await supabase
    .from('finance_entries')
    .select(
      'id, camp_id, kind, category_id, team_id, description, amount, entry_date, responsible, notes, cancelled_at, cancel_reason, created_at, category:finance_categories(name), creator:profiles!finance_entries_created_by_fkey(full_name), canceller:profiles!finance_entries_cancelled_by_fkey(full_name)',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!e) notFound();
  const camp = await getActiveCamp();
  const editable = camp?.id === e.camp_id && campEditable(camp) && !e.cancelled_at;
  const [{ data: cats }, { data: teams }, docs] = await Promise.all([
    supabase.from('finance_categories').select('id, name, active').eq('kind', e.kind).order('sort').order('name'),
    supabase.from('service_teams').select('id, name').eq('camp_id', e.camp_id).order('name'),
    listDocuments(e.kind, e.id),
  ]);
  const categories = (cats ?? []).filter((c) => c.active || c.id === e.category_id);
  const creator = e.creator as unknown as { full_name: string } | null;
  const canceller = e.canceller as unknown as { full_name: string } | null;
  const label = e.kind === 'despesa' ? 'Despesa' : 'Receita';

  return (
    <>
      <PageHeader
        title={e.description}
        description={`${label} de ${formatBRL(e.amount)} · ${formatDate(e.entry_date)}`}
        back={{ href: `/financeiro/lancamentos?tipo=${e.kind}`, label: 'Receitas e despesas' }}
        actions={e.cancelled_at ? <Badge tone="erro">Cancelado</Badge> : null}
      />
      {searchParams.aviso === 'comprovante' ? (
        <Notice tone="aviso" className="mb-5">
          O lançamento foi salvo, mas o comprovante não. Tente anexar de novo abaixo.
        </Notice>
      ) : null}
      {e.cancelled_at ? (
        <Notice tone="erro" className="mb-5" title="Lançamento cancelado">
          Em {formatDateTime(e.cancelled_at)} por {canceller?.full_name ?? '—'}. Motivo: {e.cancel_reason}
        </Notice>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel>
          {editable ? (
            <EntryForm entry={e as unknown as EntryData} categories={categories} teams={teams ?? []} today={todayISO()} />
          ) : (
            <DataList
              items={[
                { label: 'Valor', value: formatBRL(e.amount) },
                { label: 'Data', value: formatDate(e.entry_date) },
                { label: 'Categoria', value: (e.category as unknown as { name: string } | null)?.name },
                { label: 'Responsável', value: e.responsible },
                { label: 'Observações', value: e.notes },
              ]}
            />
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Comprovantes" description="Abrem por um link temporário.">
            <DocumentList docs={docs} />
            {editable ? (
              <div className="mt-4">
                <AddDocumentForm id={e.id} />
              </div>
            ) : null}
          </Panel>
          {editable ? (
            <Panel title="Cancelar lançamento" description="Lançamentos não são apagados: o cancelado fica no histórico e sai dos totais.">
              <CancelEntryForm id={e.id} />
            </Panel>
          ) : null}
          <p className="px-1 text-xs text-pedra-500">
            Lançado em {formatDateTime(e.created_at)} por {creator?.full_name ?? '—'}
          </p>
        </div>
      </div>
    </>
  );
}
