import type { Metadata } from 'next';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice } from '@/components/ui/layout';
import { Select } from '@/components/ui/input';
import { PAYMENT_STATUS } from '@/lib/labels';
import { formatBRL } from '@/lib/money';
import { FinanceTabs } from '../FinanceTabs';
import { PaymentReview } from '../../servidores/PaymentForms';

export const metadata: Metadata = { title: 'Pagamentos dos soldados/servos' };
export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  payment_status: string;
  payment_expected: number | null;
  payment_paid: number | null;
  team: { name: string } | null;
  person: { full_name: string } | null;
};

export default async function PagamentosPage({ searchParams }: { searchParams: { status?: string; equipe?: string } }) {
  await requirePerm('financeiro.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const status = searchParams.status ?? 'a_conferir';
  const supabase = createClient();
  let q = supabase
    .from('service_team_memberships')
    .select('id, payment_status, payment_expected, payment_paid, team:service_teams(name), person:people(full_name)')
    .eq('camp_id', camp.id)
    .eq('status', 'ativa')
    .limit(500);
  if (status === 'a_conferir') q = q.in('payment_status', ['comprovante_enviado', 'em_analise']);
  else if (PAYMENT_STATUS[status]) q = q.eq('payment_status', status);
  if (searchParams.equipe) q = q.eq('team_id', searchParams.equipe);
  const [{ data, error }, { data: teams }, { data: docs }] = await Promise.all([
    q,
    supabase.from('service_teams').select('id, name').eq('camp_id', camp.id).order('name'),
    supabase.from('private_documents').select('entity_id').eq('entity', 'pagamento'),
  ]);
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => (a.person?.full_name ?? '').localeCompare(b.person?.full_name ?? '', 'pt-BR'));
  const withDoc = new Set((docs ?? []).map((d) => d.entity_id));
  const total = rows.reduce((a, r) => a + Number(r.payment_paid ?? 0), 0);

  return (
    <>
      <PageHeader title="Financeiro" />
      <FinanceTabs current="pagamentos" />
      <form className="mb-4 grid gap-2 sm:grid-cols-[220px_220px_auto] sm:justify-start">
        <label htmlFor="status" className="sr-only">
          Situação
        </label>
        <Select id="status" name="status" defaultValue={status}>
          <option value="a_conferir">A conferir</option>
          <option value="todos">Todos</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <label htmlFor="equipe" className="sr-only">
          Equipe
        </label>
        <Select id="equipe" name="equipe" defaultValue={searchParams.equipe ?? ''}>
          <option value="">Todas as equipes</option>
          {(teams ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <button className="inline-flex h-11 items-center justify-center rounded-md bg-manto px-4 text-sm font-bold text-white">Filtrar</button>
      </form>
      <p className="mb-3 text-sm text-pedra-600">
        {rows.length} inscrição(ões) · valor pago informado: <strong>{formatBRL(total)}</strong>
      </p>
      <div className="rounded-lg border border-pedra-200 bg-white">
        {error ? (
          <EmptyState title="Não foi possível carregar os pagamentos" />
        ) : !rows.length ? (
          <EmptyState icon={<Wallet className="h-8 w-8" />} title={status === 'a_conferir' ? 'Nenhum pagamento aguardando conferência' : 'Nenhum pagamento encontrado'} />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {rows.map((r) => {
              const st = PAYMENT_STATUS[r.payment_status];
              return (
                <li key={r.id} className="grid gap-3 px-4 py-3 sm:px-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <Link href={`/servidores/${r.id}?aba=pagamento`} className="font-bold text-manto hover:underline">
                      {r.person?.full_name}
                    </Link>
                    <p className="text-xs text-pedra-500">
                      {r.team?.name} · pago {r.payment_paid !== null ? formatBRL(r.payment_paid) : '—'}
                      {r.payment_expected !== null ? ` de ${formatBRL(r.payment_expected)}` : ''}
                      {withDoc.has(r.id) ? ' · com comprovante' : ''}
                    </p>
                    <Badge className="mt-1" tone={st?.tone}>
                      {st?.label}
                    </Badge>
                  </div>
                  {['comprovante_enviado', 'em_analise'].includes(r.payment_status) ? <PaymentReview id={r.id} status={r.payment_status} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
