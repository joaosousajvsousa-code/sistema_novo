import type { Metadata } from 'next';
import { can, canAny, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Notice } from '@/components/ui/layout';
import { RecrutasTabs } from '@/components/RecrutasTabs';
import { AttendanceBoard, type Row } from './AttendanceBoard';

export const metadata: Metadata = { title: 'Presença' };
export const dynamic = 'force-dynamic';

export default async function PresencaPage() {
  const access = await requireCheck((a) => canAny(a, ['presenca.marcar', 'encontristas.ver']));
  const camp = await getActiveCamp();
  const { data, error } = await createClient().rpc('attendance_list', { p_q: null, p_group: null, p_status: null });
  const canMark = campEditable(camp) && (can(access, 'presenca.marcar') || can(access, 'encontristas.editar'));

  return (
    <>
      <PageHeader title="Recrutas" description="Busque o recruta, confira a tropa e a camiseta e marque a presença." />
      <RecrutasTabs current="presenca" showFichas={can(access, 'encontristas.ver')} />
      {error ? (
        <Notice tone="erro">{error.code === 'PGRST202' ? 'Rode no Supabase o arquivo 0006_presenca_camisetas.sql.' : 'Não foi possível carregar a lista.'}</Notice>
      ) : (
        <AttendanceBoard initial={(data ?? []) as Row[]} canMark={canMark} canOpenSheet={can(access, 'encontristas.ver')} />
      )}
    </>
  );
}
