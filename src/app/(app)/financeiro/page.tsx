import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Minus, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Panel, Notice, EmptyState } from '@/components/ui/layout';
import { ButtonLink, buttonClass } from '@/components/ui/button';
import { formatBRL } from '@/lib/money';
import { formatDate, todayISO } from '@/lib/format';
import { cn } from '@/lib/cn';
import { FinanceTabs } from './FinanceTabs';
import { BankBalanceForm } from './FinanceForms';

export const metadata: Metadata = { title: 'Financeiro' };
export const dynamic = 'force-dynamic';

type Summary = {
  fees: number;
  fees_count: number;
  other_income: number;
  income: number;
  expense: number;
  balance: number;
  bank_balance: number | null;
  bank_balance_date: string | null;
  payments: Record<string, { count: number; paid: number; expected: number }> | null;
  income_by_category: { name: string; total: number }[];
  expense_by_category: { id: string; name: string; total: number; budget: number | null }[];
  expense_by_team: { name: string; total: number }[];
  budget_total: number;
};

function Bar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
      <div className={cn('h-full rounded-full', over ? 'bg-erro' : 'bg-manto')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function FinanceiroPage() {
  await requirePerm('financeiro.gerenciar');
  const { data, error } = await createClient().rpc('finance_summary');
  const s = data as Summary | null;

  if (error || !s) {
    return (
      <>
        <PageHeader title="Financeiro" />
        <Notice tone="erro">{error?.code === 'PGRST202' ? 'Rode no Supabase o arquivo 0004_financeiro.sql.' : 'Não foi possível carregar o financeiro.'}</Notice>
      </>
    );
  }

  const p = s.payments ?? {};
  const toReview = (p.comprovante_enviado?.count ?? 0) + (p.em_analise?.count ?? 0);
  const pendingExpected =
    (p.pendente?.expected ?? 0) - (p.pendente?.paid ?? 0) + Math.max(0, (p.em_analise?.expected ?? 0) - (p.em_analise?.paid ?? 0)) + Math.max(0, (p.comprovante_enviado?.expected ?? 0) - (p.comprovante_enviado?.paid ?? 0));
  const inReview = (p.comprovante_enviado?.paid ?? 0) + (p.em_analise?.paid ?? 0);
  const diff = s.bank_balance !== null ? Number(s.bank_balance) - Number(s.balance) : null;
  const maxExpense = Math.max(1, ...s.expense_by_category.map((c) => Math.max(Number(c.total), Number(c.budget ?? 0))));

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Livro-caixa do acampamento. Receita dos soldados/servos entra só quando o pagamento é confirmado."
        actions={
          <>
            <a href="/financeiro/exportar" className={buttonClass('secondary')}>
              <Download className="h-4 w-4" /> Exportar Excel
            </a>
            <ButtonLink href="/financeiro/lancamentos/novo?tipo=receita" variant="secondary">
              <Plus className="h-4 w-4" /> Receita
            </ButtonLink>
            <ButtonLink href="/financeiro/lancamentos/novo?tipo=despesa">
              <Minus className="h-4 w-4" /> Despesa
            </ButtonLink>
          </>
        }
      />
      <FinanceTabs current="resumo" />

      {toReview > 0 ? (
        <Notice tone="aviso" className="mb-5">
          {toReview} pagamento(s) de soldados/servos aguardando conferência ({formatBRL(inReview)}).{' '}
          <Link href="/financeiro/pagamentos?status=a_conferir" className="font-bold underline">
            Conferir agora
          </Link>
        </Notice>
      ) : null}

      <section aria-label="Totais" className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
        <div className="relative isolate overflow-hidden rounded-2xl bg-manto-800 p-5 text-white shadow-[0_18px_40px_-18px_rgba(20,28,12,0.7)] sm:p-6">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center opacity-90" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_0%,rgba(200,161,101,0.3),transparent_60%)]" />
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cirio">
            <Wallet className="h-4 w-4" aria-hidden /> Saldo do livro-caixa
          </p>
          <p className={cn('mt-3 text-4xl font-bold leading-none sm:text-5xl', Number(s.balance) < 0 ? 'text-[#F2A79F]' : 'text-white')}>{formatBRL(s.balance)}</p>
          <p className="mt-3 text-sm text-manto-100/80">
            {pendingExpected > 0 ? `A receber dos servos: ${formatBRL(pendingExpected)}` : 'Receitas menos despesas lançadas'}
          </p>
        </div>
        <div className="rounded-2xl border border-pedra-200 bg-white p-5 shadow-[0_10px_30px_-22px_rgba(21,32,46,0.45)]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-pedra-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ok-50 text-ok">
              <TrendingUp className="h-4 w-4" aria-hidden />
            </span>
            Receitas confirmadas
          </p>
          <p className="mt-3 text-3xl font-bold leading-none text-ok">{formatBRL(s.income)}</p>
          <p className="mt-2 text-xs text-pedra-500">
            {formatBRL(s.fees)} de {s.fees_count} servo(s) · {formatBRL(s.other_income)} de outras receitas
          </p>
        </div>
        <div className="rounded-2xl border border-pedra-200 bg-white p-5 shadow-[0_10px_30px_-22px_rgba(21,32,46,0.45)]">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-pedra-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-erro-50 text-erro">
              <TrendingDown className="h-4 w-4" aria-hidden />
            </span>
            Despesas
          </p>
          <p className="mt-3 text-3xl font-bold leading-none text-erro">{formatBRL(s.expense)}</p>
          <p className="mt-2 text-xs text-pedra-500">
            {Number(s.budget_total) > 0 ? `Orçamento previsto: ${formatBRL(s.budget_total)}` : 'Sem orçamento definido'}
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Despesas por equipe e categoria" description="Comparadas com o orçamento, quando definido." bodyClassName="p-0 sm:p-0">
          {!s.expense_by_category.length ? (
            <EmptyState title="Nenhuma despesa lançada" action={<ButtonLink href="/financeiro/lancamentos/novo?tipo=despesa" size="sm">Lançar despesa</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-pedra-100">
              {s.expense_by_category.map((c) => {
                const over = c.budget !== null && Number(c.total) > Number(c.budget);
                return (
                  <li key={c.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-bold">{c.name}</span>
                      <span className={cn(over && 'font-bold text-erro')}>
                        {formatBRL(c.total)}
                        {c.budget !== null ? <span className="font-normal text-pedra-500"> de {formatBRL(c.budget)}</span> : null}
                      </span>
                    </div>
                    <Bar value={Number(c.total)} max={c.budget !== null ? Math.max(Number(c.budget), Number(c.total)) : maxExpense} over={over} />
                    {over ? <p className="mt-1 text-xs text-erro">Passou {formatBRL(Number(c.total) - Number(c.budget))} do orçamento</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Receitas por origem" bodyClassName="p-0 sm:p-0">
            <ul className="divide-y divide-pedra-100">
              <li className="flex justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span>
                  <span className="font-bold">Pagamentos dos soldados/servos</span>
                  <span className="block text-xs text-pedra-500">Somente os confirmados</span>
                </span>
                <span>{formatBRL(s.fees)}</span>
              </li>
              {s.income_by_category.map((c) => (
                <li key={c.name} className="flex justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                  <span className="font-bold">{c.name}</span>
                  <span>{formatBRL(c.total)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Saldo no banco" description="Informe o saldo do extrato para comparar com o livro-caixa.">
            {s.bank_balance === null ? (
              <p className="mb-4 text-sm text-pedra-600">Saldo bancário não informado. O livro-caixa ainda não foi conferido com o banco.</p>
            ) : (
              <div className="mb-4 text-sm">
                <p>
                  Banco em {formatDate(s.bank_balance_date)}: <strong>{formatBRL(s.bank_balance)}</strong>
                </p>
                {diff !== null && Math.abs(diff) < 0.005 ? (
                  <p className="mt-1 font-bold text-ok">Bate com o livro-caixa.</p>
                ) : (
                  <p className="mt-1 font-bold text-aviso">
                    Diferença de {formatBRL(Math.abs(diff ?? 0))} ({(diff ?? 0) > 0 ? 'o banco tem mais' : 'o banco tem menos'} que o livro-caixa).
                  </p>
                )}
              </div>
            )}
            <BankBalanceForm amount={s.bank_balance} date={s.bank_balance_date} today={todayISO()} />
          </Panel>
        </div>
      </div>
    </>
  );
}
