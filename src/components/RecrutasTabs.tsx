import { Tabs } from '@/components/ui/layout';

// Abas do módulo Recrutas: fichas, presença e fotos no mesmo lugar.
export function RecrutasTabs({ current, showFichas, showFotos = false }: { current: 'fichas' | 'presenca' | 'fotos'; showFichas: boolean; showFotos?: boolean }) {
  if (!showFichas) return null;
  return (
    <Tabs
      current={current}
      items={[
        { key: 'fichas', label: 'Fichas', href: '/encontristas' },
        { key: 'presenca', label: 'Presença', href: '/encontristas/presenca' },
        ...(showFotos ? [{ key: 'fotos', label: 'Fotos', href: '/encontristas/fotos' }] : []),
      ]}
    />
  );
}
