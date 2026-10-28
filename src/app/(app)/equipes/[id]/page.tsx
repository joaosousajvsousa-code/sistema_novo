import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, UserPlus } from 'lucide-react';
import { can, canSeeTeams, coordinatesTeam, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp, siteOrigin } from '@/lib/camp';
import { PageHeader, Panel, Badge, EmptyState, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { TEAM_STATUS } from '@/lib/labels';
import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AddCoordinatorForm, RemoveCoordinatorButton, ShareLink } from '../TeamWidgets';

export const metadata: Metadata = { title: 'Equipe' };

export default async function EquipePage({ params, searchParams }: { params: { id: string }; searchParams: { canceladas?: string; criada?: string } }) {
  const access = await requireCheck(canSeeTeams);
  const supabase = createClient();
  const { data: team } = await supabase
    .from('service_teams_overview')
    .select('id, camp_id, name, description, capacity, occupied, available, status, slug, internal_notes')
    .eq('id', params.id)
    .maybeSingle();
  if (!team) notFound();

  const camp = await getActiveCamp();
  const editable = camp?.id === team.camp_id && campEditable(camp);
  const manage = can(access, 'equipes.gerenciar') && editable;
  const isCoord = coordinatesTeam(access, team.id);
  const canMembers = can(access, 'servidores.ver_todos') || isCoord;
  const canAdd = editable && (can(access, 'servidores.editar_todos') || isCoord || can(access, 'equipes.gerenciar'));
  const showCancelled = searchParams.canceladas === '1';

  const [{ data: coords }, { data: members }, { data: users }] = await Promise.all([
    supabase.from('service_team_coordinators').select('user_id, profile:profiles!service_team_coordinators_user_id_fkey(full_name, username)').eq('team_id', team.id),
    canMembers
      ? supabase
          .from('servidores_list')
          .select('id, full_name, phone, shirt_size, status')
          .eq('team_id', team.id)
          .eq('status', showCancelled ? 'cancelada' : 'ativa')
          .order('full_name')
      : Promise.resolve({ data: null }),
    manage ? supabase.from('profiles').select('id, full_name, username').eq('active', true).order('full_name') : Promise.resolve({ data: null }),
  ]);

  const coordList = (coords ?? []).map((c) => ({ user_id: c.user_id as string, ...(c.profile as unknown as { full_name: string; username: string }) }));
  const coordIds = new Set(coordList.map((c) => c.user_id));
  const st = TEAM_STATUS[team.status];
  const pct = team.capacity ? Math.min(100, Math.round((team.occupied / team.capacity) * 100)) : 0;
  const publicUrl = `${siteOrigin()}/inscricao/${team.slug}`;
  const linkWorks = team.status === 'aberta' && camp?.status === 'inscricoes_abertas' && team.available > 0;

  return (
    <>
      <PageHeader
        title={team.name}
        description={team.description ?? undefined}
        back={{ href: '/equipes', label: 'Equipes' }}
        actions={
          <>
            {canAdd && team.status !== 'inativa' ? (
              <ButtonLink href={`/servidores/novo?equipe=${team.id}`} variant="secondary">
                <UserPlus className="h-4 w-4" /> Cadastrar servidor
              </ButtonLink>
            ) : null}
            {manage ? (
              <ButtonLink href={`/equipes/${team.id}/editar`} variant="secondary">
                <Pencil className="h-4 w-4" /> Editar
              </ButtonLink>
            ) : null}
          </>
        }
      />
      {searchParams.criada ? (
        <Notice tone="ok" className="mb-5">
          Equipe criada. Defina os coordenadores e compartilhe o link de inscrição.
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section aria-label="Vagas" className="rounded-lg border border-pedra-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {st ? <Badge tone={st.tone}>{st.label}</Badge> : null}
              {team.available === 0 ? <Badge tone="cirio">Vagas esgotadas</Badge> : null}
            </div>
            <p className="mt-3 text-sm text-pedra-600">
              <span className="text-2xl font-bold text-pedra-900">{team.occupied}</span> de {team.capacity} vagas ocupadas ·{' '}
              {team.available} disponível(is)
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-cirio' : pct >= 90 ? 'bg-aviso' : 'bg-manto')} style={{ width: `${pct}%` }} />
            </div>
          </section>

          {canMembers ? (
            <Panel
              title={showCancelled ? 'Inscrições canceladas' : 'Integrantes'}
              actions={
                <Link href={showCancelled ? `/equipes/${team.id}` : `/equipes/${team.id}?canceladas=1`} className="text-sm font-bold text-manto hover:underline">
                  {showCancelled ? 'Ver ativos' : 'Ver canceladas'}
                </Link>
              }
              bodyClassName="p-0 sm:p-0"
            >
              {!members?.length ? (
                <EmptyState
                  title={showCancelled ? 'Nenhuma inscrição cancelada' : 'Ninguém inscrito ainda'}
                  description={showCancelled ? undefined : 'Compartilhe o link de inscrição com quem vai servir nesta equipe.'}
                />
              ) : (
                <ul className="divide-y divide-pedra-100">
                  {members.map((m) => (
                    <li key={m.id}>
                      <Link href={`/servidores/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-pedra-100/60 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{m.full_name}</p>
                          <p className="text-xs text-pedra-500">{formatPhone(m.phone)}</p>
                        </div>
                        {m.shirt_size ? <Badge>{m.shirt_size}</Badge> : <Badge tone="aviso">Sem tamanho</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {team.internal_notes ? (
            <Panel title="Observações internas">
              <p className="whitespace-pre-line text-sm text-pedra-700">{team.internal_notes}</p>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel title="Link de inscrição" description="Abre só o formulário desta equipe. Não dá acesso ao sistema.">
            {!linkWorks ? (
              <Notice tone="aviso" className="mb-3">
                {camp?.status !== 'inscricoes_abertas'
                  ? 'O link está pausado: o acampamento não está com o status “Inscrições abertas”.'
                  : team.status !== 'aberta'
                    ? 'O link está pausado: as inscrições desta equipe estão fechadas.'
                    : 'O link mostra “vagas esgotadas” até que alguma vaga seja liberada.'}
              </Notice>
            ) : null}
            <ShareLink url={publicUrl} teamName={team.name} teamId={team.id} canRegenerate={manage} />
          </Panel>

          <Panel title="Coordenação">
            {coordList.length ? (
              <ul className="mb-3 divide-y divide-pedra-100">
                {coordList.map((c) => (
                  <li key={c.user_id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c.full_name}</p>
                      <p className="text-xs text-pedra-500">@{c.username}</p>
                    </div>
                    {manage ? <RemoveCoordinatorButton teamId={team.id} userId={c.user_id} name={c.full_name} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-aviso">Nenhum coordenador definido.</p>
            )}
            {manage ? <AddCoordinatorForm teamId={team.id} users={(users ?? []).filter((u) => !coordIds.has(u.id))} /> : null}
            {manage ? (
              <p className="mt-3 text-xs text-pedra-500">
                O coordenador vê só esta equipe. Dê a ele o perfil “Coordenador de equipe” em Usuários.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
