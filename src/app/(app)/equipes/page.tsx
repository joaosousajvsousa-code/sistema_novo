import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, UsersRound } from 'lucide-react';
import { can, canSeeTeams, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp, campEditable } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice } from '@/components/ui/layout';
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
      <div className="rounded-lg border border-pedra-200 bg-white">
        {error ? (
          <EmptyState title="Não foi possível carregar as equipes" description="Verifique a conexão e recarregue a página." />
        ) : !teams?.length ? (
          <EmptyState
            icon={<UsersRound className="h-8 w-8" />}
            title="Nenhuma equipe cadastrada"
            description={manage ? 'Crie as equipes de serviço para gerar os links de inscrição.' : 'Você ainda não coordena nenhuma equipe.'}
            action={manage ? <ButtonLink href="/equipes/nova">Criar a primeira equipe</ButtonLink> : null}
          />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {teams.map((t) => {
              const pct = t.capacity ? Math.min(100, Math.round((t.occupied / t.capacity) * 100)) : 0;
              const st = TEAM_STATUS[t.status];
              return (
                <li key={t.id}>
                  <Link href={`/equipes/${t.id}`} className={cn('grid gap-2 px-4 py-4 hover:bg-pedra-100/60 sm:grid-cols-[1fr_220px] sm:items-center sm:gap-6 sm:px-5', t.status === 'inativa' && 'opacity-60')}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{t.name}</span>
                        {st ? <Badge tone={st.tone}>{st.label}</Badge> : null}
                        {t.coordinator_count === 0 && t.status !== 'inativa' ? <Badge tone="aviso">Sem coordenador</Badge> : null}
                      </div>
                      {t.description ? <p className="mt-0.5 line-clamp-1 text-sm text-pedra-500">{t.description}</p> : null}
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-pedra-600">
                        <span>
                          <strong className="text-pedra-900">{t.occupied}</strong> de {t.capacity} vagas
                        </span>
                        <span>{t.available > 0 ? `${t.available} livre(s)` : 'Esgotada'}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-cirio' : pct >= 90 ? 'bg-aviso' : 'bg-manto')} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
