import type { Metadata } from 'next';
import Link from 'next/link';
import { Shapes, Shuffle } from 'lucide-react';
import { can, requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, EmptyState, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { NewGroupForm } from './GroupForms';
import { leaderNames, loadAvailableLeaders, loadGroupLeaders } from '@/lib/tenentes';

export const metadata: Metadata = { title: 'Tropas' };

export default async function GruposPage() {
  const access = await requirePerm('encontristas.ver', 'grupos.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) {
    return (
      <>
        <PageHeader title="Tropas de recrutas" />
        <Notice>Nenhum acampamento ativo.</Notice>
      </>
    );
  }
  const manage = can(access, 'grupos.gerenciar') && campEditable(camp);
  const supabase = createClient();
  const [{ data: groups, error }, { count: semGrupo }, leadersByGroup, leaderTeam] = await Promise.all([
    supabase.from('participant_groups_overview').select('id, name, capacity, occupied').eq('camp_id', camp.id).order('name'),
    supabase.from('encontristas_list').select('id', { count: 'exact', head: true }).eq('camp_id', camp.id).eq('status', 'ativo').is('group_id', null),
    loadGroupLeaders(),
    manage ? supabase.rpc('leaders_team_id', { p_camp: camp.id }) : Promise.resolve({ data: null }),
  ]);
  const leaderOptions = manage ? (leaderTeam.data ? await loadAvailableLeaders() : null) : null;
  const total = (groups ?? []).reduce((a, g) => a + g.occupied, 0);

  return (
    <>
      <PageHeader
        title="Tropas de recrutas"
        description="Separados das equipes de serviço. Cada recruta participa de uma tropa."
        actions={
          manage ? (
            <ButtonLink href="/grupos/distribuir">
              <Shuffle className="h-4 w-4" /> Distribuir recrutas
            </ButtonLink>
          ) : null
        }
      />
      {(semGrupo ?? 0) > 0 ? (
        <Notice tone="aviso" className="mb-5">
          {semGrupo} recruta(s) ainda sem tropa.{' '}
          {manage ? (
            <Link href="/grupos/distribuir" className="font-bold underline">
              Distribuir agora
            </Link>
          ) : null}
        </Notice>
      ) : null}
      <Panel
        title={`${groups?.length ?? 0} tropa(s)`}
        description={groups?.length ? `${total} recruta(s) distribuído(s)` : undefined}
        bodyClassName="p-0 sm:p-0"
      >
        {error ? (
          <EmptyState title="Não foi possível carregar as tropas" />
        ) : !groups?.length ? (
          <EmptyState icon={<Shapes className="h-8 w-8" />} title="Nenhuma tropa criada" description={manage ? 'Crie as tropas e depois distribua os recrutas.' : undefined} />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {groups.map((g) => {
              const pct = g.capacity ? Math.min(100, Math.round((g.occupied / g.capacity) * 100)) : null;
              return (
                <li key={g.id}>
                  <Link href={`/grupos/${g.id}`} className="grid gap-2 px-4 py-3 hover:bg-pedra-100/60 sm:grid-cols-[1fr_200px] sm:items-center sm:gap-6 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{g.name}</p>
                      {leadersByGroup[g.id]?.length ? (
                        <p className="truncate text-xs text-pedra-500">Tenentes: {leaderNames(leadersByGroup[g.id])}</p>
                      ) : (
                        <p className="text-xs text-aviso">Sem tenente</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-pedra-600">
                        <strong className="text-pedra-900">{g.occupied}</strong>
                        {g.capacity ? ` de ${g.capacity}` : ''} integrante(s)
                      </p>
                      {pct !== null ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
                          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-cirio' : 'bg-manto')} style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {manage ? (
          <div className="border-t border-pedra-200 p-4 sm:p-5">
            <NewGroupForm leaders={leaderOptions} />
          </div>
        ) : null}
      </Panel>
    </>
  );
}
