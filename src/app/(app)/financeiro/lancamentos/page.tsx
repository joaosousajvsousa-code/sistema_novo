import type { Metadata } from 'next';
import Link from 'next/link';
import { Minus, Paperclip, Plus, Receipt } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice, Pagination } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { formatBRL } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { FinanceTabs } from '../FinanceTabs';

export const metadata: Metadata = { title: 'Receitas e despesas' };
export const dynamic = 'force-dynamic';
const PAGE = 50;

type SP = { tipo?: string; categoria?: string; situacao?: string; pagina?: string; salvo?: string };

export default async function LancamentosPage({ searchParams }: { searchParams: SP }) {
  await requirePerm('financeiro.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const tipo = searchParams.tipo === 'receita' || searchParams.tipo === 'despesa' ? searchParams.tipo : null;
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const supabase = createClient();

  let q = supabase
    .from('finance_entries')
    .select('id, kind, description, amount, entry_date, responsible, cancelled_at, category:finance_categories(name), team:service_teams(name)', { count: 'exact' })
    .eq('camp_id', camp.id)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (tipo) q = q.eq('kind', tipo);
  if (searchParams.categoria) q = q.eq('category_id', searchParams.categoria);
  if (searchParams.situacao === 'canceladas') q = q.not('cancelled_at', 'is', null);
  else q = q.is('cancelled_at', null);

  let totalsQ = supabase.from('finance_entries').select('kind, amount').eq('camp_id', camp.id).is('cancelled_at', null);
  if (searchParams.categoria) totalsQ = totalsQ.eq('category_id', searchParams.categoria);

  const [{ data: rows, count, error }, { data: cats }, { data: totals }, { data: docs }] = await Promise.all([
    q,
    supabase.from('finance_categories').select('id, name, kind').order('kind').order('sort').order('name'),
    totalsQ,
    supabase.from('private_documents').select('entity_id').in('entity', ['receita', 'despesa']),
  ]);
  const withDoc = new Set((docs ?? []).map((d) => d.entity_id));
  const sum = (k: string) => (totals ?? []).filter((t) => t.kind === k).reduce((a, t) => a + Number(t.amount), 0);
  const params = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => v && k !== 'pagina' && k !== 'salvo') as [string, string][]);

  return (
    <>
      <PageHeader
        title="Financeiro"
        actions={
          <>
            <ButtonLink href="/financeiro/lancamentos/novo?tipo=receita" variant="secondary">
              <Plus className="h-4 w-4" /> Receita
            </ButtonLink>
            <ButtonLink href="/financeiro/lancamentos/novo?tipo=despesa">
              <Minus className="h-4 w-4" /> Despesa
            </ButtonLink>
          </>
        }
      />
      <FinanceTabs current="lancamentos" />
      {searchParams.salvo ? (
        <Notice tone="ok" className="mb-4">
          Lançamento salvo.
        </Notice>
      ) : null}

      <form className="mb-4 grid gap-2 sm:grid-cols-[160px_1fr_160px_auto]">
        <label htmlFor="tipo" className="sr-only">
          Tipo
        </label>
        <Select id="tipo" name="tipo" defaultValue={tipo ?? ''}>
          <option value="">Receitas e despesas</option>
          <option value="receita">Só receitas</option>
          <option value="despesa">Só despesas</option>
        </Select>
        <label htmlFor="categoria" className="sr-only">
          Categoria
        </label>
        <Select id="categoria" name="categoria" defaultValue={searchParams.categoria ?? ''}>
          <option value="">Todas as categorias</option>
          {(cats ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.kind === 'receita' ? 'Receita · ' : 'Despesa · '}
              {c.name}
            </option>
          ))}
        </Select>
        <label htmlFor="situacao" className="sr-only">
          Situação
        </label>
        <Select id="situacao" name="situacao" defaultValue={searchParams.situacao ?? ''}>
          <option value="">Válidos</option>
          <option value="canceladas">Cancelados</option>
        </Select>
        <button className="inline-flex h-11 items-center justify-center rounded-md bg-manto px-4 text-sm font-bold text-white">Filtrar</button>
      </form>

      {searchParams.situacao !== 'canceladas' ? (
        <p className="mb-3 text-sm text-pedra-600">
          {tipo !== 'despesa' ? (
            <>
              Receitas lançadas: <strong className="text-ok">{formatBRL(sum('receita'))}</strong>
            </>
          ) : null}
          {!tipo ? ' · ' : null}
          {tipo !== 'receita' ? (
            <>
              Despesas: <strong className="text-erro">{formatBRL(sum('despesa'))}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="rounded-lg border border-pedra-200 bg-white">
        {error ? (
          <EmptyState title="Não foi possível carregar os lançamentos" />
        ) : !rows?.length ? (
          <EmptyState icon={<Receipt className="h-8 w-8" />} title="Nenhum lançamento encontrado" />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {rows.map((r) => {
              const cat = r.category as unknown as { name: string } | null;
              const team = r.team as unknown as { name: string } | null;
              const receita = r.kind === 'receita';
              return (
                <li key={r.id}>
                  <Link href={`/financeiro/lancamentos/${r.id}`} className={cn('grid grid-cols-[1fr_auto] gap-x-3 px-4 py-3 hover:bg-pedra-100/60 sm:px-5', r.cancelled_at && 'opacity-60')}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn('truncate font-bold', r.cancelled_at && 'line-through')}>{r.description}</span>
                        {withDoc.has(r.id) ? <Paperclip className="h-3.5 w-3.5 shrink-0 text-pedra-400" aria-label="Com comprovante" /> : null}
                      </span>
                      <span className="block text-xs text-pedra-500">
                        {formatDate(r.entry_date)} · {cat?.name}
                        {team ? ` · ${team.name}` : ''}
                        {r.responsible ? ` · ${r.responsible}` : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={cn('block font-bold', receita ? 'text-ok' : 'text-erro')}>
                        {receita ? '+' : '−'} {formatBRL(r.amount)}
                      </span>
                      {r.cancelled_at ? <Badge>Cancelado</Badge> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Pagination
        page={page}
        pageSize={PAGE}
        total={count ?? 0}
        makeHref={(p) => {
          const sp = new URLSearchParams(params);
          sp.set('pagina', String(p));
          return `/financeiro/lancamentos?${sp.toString()}`;
        }}
      />
    </>
  );
}
