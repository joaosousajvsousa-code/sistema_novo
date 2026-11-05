import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, EmptyState } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { ageOn, formatPhone, whatsappLink } from '@/lib/format';
import { MessageCircle, Star, Users } from 'lucide-react';
import { TropaCover } from '@/components/TropaCover';
import { RecrutaAvatar } from '@/components/RecrutaAvatar';
import { DeleteGroupForm, EditGroupForm, type GroupData } from '../GroupForms';
import { loadAvailableLeaders, loadGroupLeaders } from '@/lib/tenentes';

export const metadata: Metadata = { title: 'Tropa' };

export default async function GrupoPage({ params }: { params: { id: string } }) {
  const access = await requirePerm('encontristas.ver', 'grupos.gerenciar');
  const supabase = createClient();
  const { data: g } = await supabase
    .from('participant_groups_overview')
    .select('id, camp_id, name, image, description, capacity, notes, occupied')
    .eq('id', params.id)
    .maybeSingle();
  if (!g) notFound();
  const camp = await getActiveCamp();
  const manage = can(access, 'grupos.gerenciar') && camp?.id === g.camp_id && campEditable(camp);
  const canSee = can(access, 'encontristas.ver');
  const leadersByGroup = await loadGroupLeaders();
  const leaders = leadersByGroup[g.id] ?? [];
  const leaderTeam = manage ? (await supabase.rpc('leaders_team_id', { p_camp: g.camp_id })).data : null;
  const leaderOptions = manage && leaderTeam ? await loadAvailableLeaders() : null;
  const { data: members } = canSee
    ? await supabase.from('encontristas_list').select('id, full_name, phone, birth_date, shirt_size, photo_path').eq('group_id', g.id).eq('status', 'ativo').order('full_name')
    : { data: null };

  return (
    <>
      <PageHeader
        title={g.name}
        back={{ href: '/grupos', label: 'Tropas' }}
        actions={
          manage ? (
            <ButtonLink href="/grupos/distribuir" variant="secondary">
              Adicionar recrutas
            </ButtonLink>
          ) : null
        }
      />

      <section className="mb-6 grid gap-5 overflow-hidden rounded-2xl border border-pedra-200 bg-white p-4 shadow-[0_10px_30px_-20px_rgba(21,32,46,0.45)] sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
        <TropaCover g={g} priority />
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-pedra p-4">
              <dt className="flex items-center gap-1.5 text-xs text-pedra-500">
                <Users className="h-3.5 w-3.5" aria-hidden /> Recrutas
              </dt>
              <dd className="mt-1 text-3xl font-bold">
                {g.occupied}
                {g.capacity ? <span className="text-base font-normal text-pedra-500"> de {g.capacity}</span> : null}
              </dd>
            </div>
            <div className="rounded-xl bg-pedra p-4">
              <dt className="flex items-center gap-1.5 text-xs text-pedra-500">
                <Star className="h-3.5 w-3.5" aria-hidden /> Tenentes
              </dt>
              <dd className="mt-1 text-3xl font-bold">{leaders.length}</dd>
            </div>
          </dl>
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-manto">Tenentes</h2>
            {leaders.length ? (
              <ul className="space-y-2">
                {leaders.map((l) => {
                  const wa = whatsappLink(l.phone);
                  return (
                    <li key={l.membership_id} className="flex items-center gap-3 rounded-xl border border-pedra-200 px-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cirio-50 text-sm font-bold text-cirio-700">
                        {l.full_name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{l.full_name}</span>
                        {l.phone ? <span className="block text-xs text-pedra-500">{formatPhone(l.phone)}</span> : null}
                      </span>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${l.full_name}`} className="flex h-9 w-9 items-center justify-center rounded-md text-ok hover:bg-ok-50">
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-aviso/30 bg-aviso-50 px-3 py-2.5 text-sm text-[#6E480D]">Nenhum tenente definido.{manage ? ' Escolha em “Dados da tropa”.' : ''}</p>
            )}
          </div>
          {g.description ? <p className="whitespace-pre-line text-sm text-pedra-700">{g.description}</p> : null}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel title={`Recrutas (${members?.length ?? 0})`} bodyClassName="p-0 sm:p-0">
          {!canSee ? (
            <EmptyState title="Sem permissão para ver os integrantes" />
          ) : !members?.length ? (
            <EmptyState title="Nenhum recruta ainda" description={manage ? 'Use “Adicionar recrutas” para distribuir.' : undefined} />
          ) : (
            <ul className="divide-y divide-pedra-100">
              {members.map((m) => {
                const age = ageOn(m.birth_date);
                return (
                  <li key={m.id}>
                    <Link href={`/encontristas/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-pedra-100/60 sm:px-5">
                      <RecrutaAvatar id={m.id} name={m.full_name} path={m.photo_path} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{m.full_name}</p>
                        <p className="text-xs text-pedra-500">
                          {age !== null ? `${age} anos` : ''}
                          {m.phone ? `${age !== null ? ' · ' : ''}${formatPhone(m.phone)}` : ''}
                        </p>
                      </div>
                      {m.shirt_size ? <Badge>{m.shirt_size}</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <div className="space-y-5">
          {manage ? (
            <Panel title="Dados da tropa">
              <EditGroupForm g={g as GroupData} leaders={leaderOptions} selected={leaders.map((l) => l.membership_id)} />
            </Panel>
          ) : g.notes ? (
            <Panel title="Observações">
              <p className="whitespace-pre-line text-sm text-pedra-600">{g.notes}</p>
            </Panel>
          ) : null}
          {manage && g.occupied === 0 ? (
            <Panel title="Excluir tropa">
              <DeleteGroupForm id={g.id} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
