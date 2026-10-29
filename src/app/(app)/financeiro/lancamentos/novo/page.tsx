import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { todayISO } from '@/lib/format';
import { EntryForm } from '../../FinanceForms';

export const metadata: Metadata = { title: 'Novo lançamento' };

export default async function NovoLancamentoPage({ searchParams }: { searchParams: { tipo?: string; salvo?: string } }) {
  await requirePerm('financeiro.gerenciar');
  const camp = await getActiveCamp();
  if (!camp || !campEditable(camp)) redirect('/financeiro');
  const kind = searchParams.tipo === 'receita' ? 'receita' : 'despesa';
  const supabase = createClient();
  const [{ data: cats }, { data: teams }] = await Promise.all([
    supabase.from('finance_categories').select('id, name').eq('kind', kind).eq('active', true).order('sort').order('name'),
    supabase.from('service_teams').select('id, name').eq('camp_id', camp.id).neq('status', 'inativa').order('name'),
  ]);
  return (
    <>
      <PageHeader
        title={kind === 'despesa' ? 'Lançar despesa' : 'Lançar receita'}
        description={kind === 'receita' ? 'Pagamentos dos soldados/servos não entram aqui: eles são somados sozinhos quando confirmados na ficha.' : undefined}
        back={{ href: `/financeiro/lancamentos?tipo=${kind}`, label: 'Receitas e despesas' }}
      />
      {searchParams.salvo ? (
        <Notice tone="ok" className="mb-5">
          Lançamento salvo. Pode lançar o próximo.
        </Notice>
      ) : null}
      <Panel>
        <EntryForm key={searchParams.salvo ?? 'novo'} entry={{ kind }} categories={cats ?? []} teams={teams ?? []} today={todayISO()} />
      </Panel>
    </>
  );
}
