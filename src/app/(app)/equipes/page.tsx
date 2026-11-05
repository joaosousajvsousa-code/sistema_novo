import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, UsersRound } from 'lucide-react';
import { can, canSeeTeams, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp, campEditable } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice, StatRow } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { TEAM_STATUS } from '@/lib/labels';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Equipes de serviço' };

export default async function EquipesPage() {
  const access = await requireCheck(canSeeTeams);
  const camp = await getActiveCamp();
  const manage = can(access, 'equipes.gerenciar') && campEditable(camp);

  if (!camp) {
    return (
      <>
        <PageHeader title="Equipes de serviço" />
        <Notice>Nenhum acampamento ativo.</Notice>
      </>
    );
  }

  const supabase = createClient();
  const { data: teams, error } = await supabase
    .from('service_teams_overview')
    .select('id, name, description, capacity, occupied, available, status, coordinator_count')
    .eq('camp_id', camp.id)
    .order('status')
    .order('name');

  const totals = (teams ?? []).filter((t) => t.status !== 'inativa').reduce((acc, t) => ({ occ: acc.occ + t.occupied, cap: acc.cap + t.capacity }), { occ: 0, cap: 0 });

  return (
    <>
      <PageHeader
        title="Equipes de serviço"
        description={teams?.length ? `${totals.occ} de ${totals.cap} vagas ocupadas` : undefined}
        actions={
          manage ? (
            <ButtonLink href="/equipes/nova">
              <Plus className="h-4 w-4" /> Nova equipe
            </ButtonLink>
          ) : null
        }
      />
      {error ? (
        <Notice tone="erro">Não foi possível carregar as equipes. Verifique a conexão e recarregue a página.</Notice>
      ) : !teams?.length ? (
        <div className="overflow-hidden rounded-2xl border border-pedra-200 bg-white">
          <EmptyState
            icon={<UsersRound className="h-8 w-8" />}
            title="Nenhuma equipe cadastrada"
            description={manage ? 'Crie as equipes de serviço para gerar os links de inscrição.' : 'Você ainda não coordena nenhuma equipe.'}
            action={manage ? <ButtonLink href="/equipes/nova">Criar a primeira equipe</ButtonLink> : null}
          />
        </div>
      ) : (
        <>
          <StatRow
            items={[
              { label: 'Equipes', value: teams.filter((t) => t.status !== 'inativa').length },
              { label: 'Vagas ocupadas', value: `${totals.occ}`, sub: `de ${totals.cap}` },
              { label: 'Vagas livres', value: Math.max(0, totals.cap - totals.occ), tone: 'ok' },
              { label: 'Sem coordenador', value: teams.filter((t) => t.coordinator_count === 0 && t.status !== 'inativa').length, tone: 'aviso' },
            ]}
          />
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((t) => {
              const pct = t.capacity ? Math.min(100, Math.round((t.occupied / t.capacity) * 100)) : 0;
              const st = TEAM_STATUS[t.status];
              return (
                <li key={t.id}>
                  <Link
                    href={`/equipes/${t.id}`}
                    className={cn(
                      'group flex h-full flex-col overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-20px_rgba(21,32,46,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(21,32,46,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cirio',
                      t.status === 'inativa' && 'opacity-60',
                    )}
                  >
                    <div className="relative isolate overflow-hidden bg-manto-800 px-5 pb-5 pt-4 text-white">
                      <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center opacity-90" />
                      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_0%,rgba(200,161,101,0.3),transparent_60%)]" />
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-cirio ring-1 ring-white/15">
                          {t.name.charAt(0).toUpperCase()}
                        </span>
                        {st ? <Badge tone={st.tone} className="ring-1 ring-white/20">{st.label}</Badge> : null}
                      </div>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-cirio/90">Equipe</p>
                      <h2 className="truncate text-2xl leading-tight text-white">{t.name}</h2>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      {t.description ? <p className="mb-4 line-clamp-2 text-sm text-pedra-600">{t.description}</p> : null}
                      <div className="mt-auto">
                        <div className="flex items-end justify-between">
                          <p className="text-3xl font-bold leading-none text-pedra-900">
                            {t.occupied}
                            <span className="text-base font-normal text-pedra-400">/{t.capacity}</span>
                          </p>
                          <span className={cn('text-xs font-bold', t.available > 0 ? 'text-ok' : 'text-cirio-700')}>
                            {t.available > 0 ? `${t.available} vaga(s) livre(s)` : 'Esgotada'}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
                          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-cirio' : pct >= 90 ? 'bg-aviso' : 'bg-manto')} style={{ width: `${pct}%` }} />
                        </div>
                        {t.coordinator_count === 0 && t.status !== 'inativa' ? (
                          <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-aviso-50 px-2 py-1 text-xs font-bold text-aviso">Sem coordenador</p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
