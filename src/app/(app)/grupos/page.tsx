import type { Metadata } from 'next';
import Link from 'next/link';
import { Shapes, Shuffle, Star, Users } from 'lucide-react';
import { TropaCover } from '@/components/TropaCover';
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
    supabase.from('participant_groups_overview').select('id, name, image, capacity, occupied').eq('camp_id', camp.id).order('name'),
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
      {error ? (
        <Notice tone="erro">Não foi possível carregar as tropas.</Notice>
      ) : !groups?.length ? (
        <div className="rounded-xl border border-pedra-200 bg-white">
          <EmptyState icon={<Shapes className="h-8 w-8" />} title="Nenhuma tropa criada" description={manage ? 'Crie as tropas e depois distribua os recrutas.' : undefined} />
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-pedra-600">
            <strong className="text-pedra-900">{groups.length}</strong> tropa(s) · <strong className="text-pedra-900">{total}</strong> recruta(s) distribuído(s)
          </p>
          <ul className="grid gap-5 md:grid-cols-2">
            {groups.map((g) => {
              const pct = g.capacity ? Math.min(100, Math.round((g.occupied / g.capacity) * 100)) : null;
              const leaders = leadersByGroup[g.id] ?? [];
              return (
                <li key={g.id}>
                  <Link
                    href={`/grupos/${g.id}`}
                    className="group block overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-20px_rgba(21,32,46,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(21,32,46,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cirio"
                  >
                    <div className="bg-pedra p-3 pb-0">
                      <TropaCover g={g} />
                    </div>
                    <div className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                      <div className="min-w-0 flex-1">
                        {leaders.length ? (
                          <p className="flex items-center gap-1.5 truncate text-sm">
                            <Star className="h-4 w-4 shrink-0 text-cirio-700" aria-hidden />
                            <span className="truncate">
                              <span className="text-pedra-500">Tenentes: </span>
                              <strong>{leaderNames(leaders)}</strong>
                            </span>
                          </p>
                        ) : (
                          <p className="flex items-center gap-1.5 text-sm font-bold text-aviso">
                            <Star className="h-4 w-4" aria-hidden /> Sem tenente
                          </p>
                        )}
                        {pct !== null ? (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
                            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-cirio' : 'bg-manto')} style={{ width: `${pct}%` }} />
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="inline-flex items-center gap-1.5 text-lg font-bold text-pedra-900">
                          <Users className="h-4 w-4 text-pedra-400" aria-hidden />
                          {g.occupied}
                          {g.capacity ? <span className="text-sm font-normal text-pedra-500">/{g.capacity}</span> : null}
                        </p>
                        <p className="text-xs text-pedra-500">recrutas</p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {manage ? (
        <Panel title="Nova tropa" className="mt-6">
          <NewGroupForm leaders={leaderOptions} />
        </Panel>
      ) : null}
    </>
  );
}
