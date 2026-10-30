import { Tabs } from '@/components/ui/layout';

// Abas do módulo Recrutas: fichas e presença no mesmo lugar.
export function RecrutasTabs({ current, showFichas }: { current: 'fichas' | 'presenca'; showFichas: boolean }) {
  if (!showFichas) return null;
  return (
    <Tabs
      current={current}
      items={[
        { key: 'fichas', label: 'Fichas', href: '/encontristas' },
        { key: 'presenca', label: 'Presença', href: '/encontristas/presenca' },
      ]}
    />
  );
}
