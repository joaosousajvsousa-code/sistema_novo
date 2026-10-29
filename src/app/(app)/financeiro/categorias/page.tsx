import type { Metadata } from 'next';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, Notice } from '@/components/ui/layout';
import { FinanceTabs } from '../FinanceTabs';
import { BudgetForm, NewCategoryForm, ToggleCategoryButton } from '../FinanceForms';

export const metadata: Metadata = { title: 'Categorias e orçamento' };
export const dynamic = 'force-dynamic';

export default async function CategoriasPage() {
  await requirePerm('financeiro.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const supabase = createClient();
  const [{ data: cats }, { data: budgets }, { data: spent }] = await Promise.all([
    supabase.from('finance_categories').select('id, name, kind, active').order('sort').order('name'),
    supabase.from('finance_budgets').select('category_id, amount').eq('camp_id', camp.id),
    supabase.from('finance_entries').select('category_id, amount').eq('camp_id', camp.id).eq('kind', 'despesa').is('cancelled_at', null),
  ]);
  const budgetBy = Object.fromEntries((budgets ?? []).map((b) => [b.category_id, Number(b.amount)]));
  const spentBy: Record<string, number> = {};
  for (const s of spent ?? []) spentBy[s.category_id] = (spentBy[s.category_id] ?? 0) + Number(s.amount);
  const despesas = (cats ?? []).filter((c) => c.kind === 'despesa');
  const receitas = (cats ?? []).filter((c) => c.kind === 'receita');

  return (
    <>
      <PageHeader title="Financeiro" />
      <FinanceTabs current="categorias" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Orçamento previsto" description="Quanto se espera gastar em cada categoria.">
          <BudgetForm rows={despesas.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name, budget: budgetBy[c.id] ?? null, spent: spentBy[c.id] ?? 0 }))} />
        </Panel>
        <div className="space-y-5">
          {[
            { title: 'Categorias de despesa', list: despesas, kind: 'despesa' as const },
            { title: 'Origens de receita', list: receitas, kind: 'receita' as const },
          ].map((g) => (
            <Panel key={g.kind} title={g.title}>
              <ul className="mb-4 divide-y divide-pedra-100">
                {g.list.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-sm">
                      {c.name} {!c.active ? <Badge>Desativada</Badge> : null}
                    </span>
                    <ToggleCategoryButton id={c.id} active={c.active} />
                  </li>
                ))}
              </ul>
              <NewCategoryForm kind={g.kind} />
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}
