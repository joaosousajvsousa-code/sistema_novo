import { Tabs } from '@/components/ui/layout';

export function FinanceTabs({ current }: { current: 'resumo' | 'lancamentos' | 'pagamentos' | 'categorias' }) {
  return (
    <Tabs
      current={current}
      items={[
        { key: 'resumo', label: 'Resumo', href: '/financeiro' },
        { key: 'lancamentos', label: 'Receitas e despesas', href: '/financeiro/lancamentos' },
        { key: 'pagamentos', label: 'Pagamentos dos servos', href: '/financeiro/pagamentos' },
        { key: 'categorias', label: 'Categorias e orçamento', href: '/financeiro/categorias' },
      ]}
    />
  );
}
