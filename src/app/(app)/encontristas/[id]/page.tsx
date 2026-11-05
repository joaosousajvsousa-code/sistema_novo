import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HeartPulse, IdCard, Lock, MessageCircle, Phone as PhoneIcon, Siren } from 'lucide-react';
import { can, requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, DataList, Notice, Tabs } from '@/components/ui/layout';
import { cn } from '@/lib/cn';
import { HistoryList } from '@/components/HistoryList';
import { ageOn, formatDate, formatDateTime, formatPhone, whatsappLink } from '@/lib/format';
import { ATTENDANCE, ENCONTRISTA_STATUS, HEALTH_STATUS } from '@/lib/labels';
import { EditEncontristaForm, EditHealthForm, type EncontristaData, type HealthData } from '../EncontristaForm';
import { FichaStatusForm, GroupForm } from './FichaActions';
import { leaderNames, loadGroupLeaders } from '@/lib/tenentes';

export const metadata: Metadata = { title: 'Ficha do recruta' };

const TABS = ['dados', 'grupo', 'historico', 'editar'] as const;
type Tab = (typeof TABS)[number];

// Cartão em destaque da aba Dados pessoais.
function HighlightCard({
  icon,
  title,
  tone,
  aside,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: 'manto' | 'erro' | 'cirio';
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = {
    manto: { bar: 'bg-manto', chip: 'bg-manto-50 text-manto' },
    erro: { bar: 'bg-erro', chip: 'bg-erro-50 text-erro' },
    cirio: { bar: 'bg-cirio', chip: 'bg-cirio-50 text-cirio-700' },
  }[tone];
  return (
    <section className="overflow-hidden rounded-xl border border-pedra-200 bg-white shadow-[0_10px_30px_-18px_rgba(21,32,46,0.35)]">
      <div aria-hidden className={cn('h-1.5', t.bar)} />
      <header className="flex items-center gap-3 px-5 pt-4">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', t.chip)}>{icon}</span>
        <h2 className="min-w-0 flex-1 text-base">{title}</h2>
        {aside}
      </header>
      <div className="px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}

function Phone({ value }: { value: string | null }) {
  if (!value) return null;
  const wa = whatsappLink(value);
  return (
    <span className="flex items-center gap-2">
      <a href={`tel:+55${value}`} className="text-manto hover:underline">
        {formatPhone(value)}
      </a>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="text-ok" aria-label="Abrir no WhatsApp">
          <MessageCircle className="h-4 w-4" />
        </a>
      ) : null}
    </span>
  );
}

export default async function FichaPage({ params, searchParams }: { params: { id: string }; searchParams: { aba?: string; novo?: string; salvo?: string } }) {
  const access = await requirePerm('encontristas.ver');
  const supabase = createClient();
  const { data: e } = await supabase
    .from('encontristas')
    .select(
      'id, camp_id, person_id, status, shirt_size, attendance_status, attendance_at, attendance_by_profile:profiles!encontristas_attendance_by_fkey(full_name), emergency_name, emergency_phone, emergency_relationship, form_notes, admin_notes, created_at, creator:profiles!encontristas_created_by_fkey(full_name), person:people(full_name, phone, birth_date), assignment:participant_group_assignments(group_id, assigned_at, group:participant_groups(name))',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!e) notFound();

  const camp = await getActiveCamp();
  const editable = camp?.id === e.camp_id && campEditable(camp);
  const canEdit = editable && can(access, 'encontristas.editar');
  const canHealth = can(access, 'saude.ver');
  const canGroups = editable && can(access, 'grupos.gerenciar');
  // Emergência e saúde agora ficam em Dados pessoais (links antigos continuam funcionando).
  const requested = (TABS as readonly string[]).includes(searchParams.aba ?? '') ? (searchParams.aba as Tab) : 'dados';
  const tab: Tab = requested === 'editar' && !canEdit ? 'dados' : requested;

  const person = e.person as unknown as { full_name: string; phone: string | null; birth_date: string | null };
  const creator = e.creator as unknown as { full_name: string } | null;
  const assignment = (Array.isArray(e.assignment) ? e.assignment[0] : e.assignment) as unknown as
    | { group_id: string; assigned_at: string; group: { name: string } | null }
    | null
    | undefined;
  const st = ENCONTRISTA_STATUS[e.status];
  const age = ageOn(person.birth_date);
  const base = `/encontristas/${e.id}`;

  // Saúde: só busca na aba Dados pessoais, para quem pode ver (cada leitura fica registrada).
  type HealthView = HealthData & { updated_at: string | null; updated_by_name: string | null };
  let health: HealthView | null = null;
  let healthError = false;
  if (tab === 'dados' && canHealth) {
    const { data, error } = await supabase.rpc('get_encontrista_health', { p_id: e.id });
    health = (data as HealthView | null) ?? null;
    healthError = Boolean(error);
  }

  const tenentes = tab === 'grupo' && assignment?.group_id ? leaderNames((await loadGroupLeaders())[assignment.group_id]) : '';
  let groups: { id: string; name: string; capacity: number | null; occupied: number }[] = [];
  if (tab === 'grupo' && canGroups) {
    const { data } = await supabase.from('participant_groups_overview').select('id, name, capacity, occupied').eq('camp_id', e.camp_id).order('name');
    groups = data ?? [];
  }

  let history: Parameters<typeof HistoryList>[0]['entries'] = [];
  let groupNames: Record<string, string> = {};
  if (tab === 'historico') {
    const [{ data: h }, { data: gs }] = await Promise.all([
      supabase.rpc('record_history', { p_entity: 'encontrista', p_id: e.id }),
      supabase.from('participant_groups').select('id, name').eq('camp_id', e.camp_id),
    ]);
    history = (h ?? []) as typeof history;
    groupNames = Object.fromEntries((gs ?? []).map((g) => [g.id, g.name]));
  }

  return (
    <>
      <PageHeader
        title={person.full_name}
        description={`${age !== null ? `${age} anos · ` : ''}${assignment?.group?.name ?? 'Sem tropa'}`}
        back={{ href: '/encontristas', label: 'Recrutas' }}
        actions={e.status !== 'ativo' && st ? <Badge tone={st.tone}>Ficha {st.label.toLowerCase()}</Badge> : null}
      />
      {searchParams.novo ? (
        <Notice tone="ok" className="mb-5">
          Ficha cadastrada.
        </Notice>
      ) : searchParams.salvo ? (
        <Notice tone="ok" className="mb-5">
          Alterações salvas.
        </Notice>
      ) : null}
      <Tabs
        current={tab}
        items={[
          { key: 'dados', label: 'Dados pessoais', href: base },
          { key: 'grupo', label: 'Tropa', href: `${base}?aba=grupo` },
          { key: 'historico', label: 'Histórico', href: `${base}?aba=historico` },
          ...(canEdit ? [{ key: 'editar', label: 'Editar', href: `${base}?aba=editar` }] : []),
        ]}
      />

      {tab === 'dados' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <HighlightCard icon={<IdCard className="h-5 w-5" aria-hidden />} title="Dados pessoais" tone="manto">
              <DataList
                items={[
                  { label: 'Nome completo', value: person.full_name },
                  { label: 'Telefone', value: <Phone value={person.phone} /> },
                  { label: 'Nascimento', value: person.birth_date ? `${formatDate(person.birth_date)}${age !== null ? ` (${age} anos)` : ''}` : null },
                  { label: 'Camiseta', value: e.shirt_size },
                ]}
              />
            </HighlightCard>

            <HighlightCard icon={<Siren className="h-5 w-5" aria-hidden />} title="Contato de emergência" tone="erro">
              {e.emergency_name || e.emergency_phone ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{e.emergency_name ?? '—'}</p>
                    {e.emergency_relationship ? <p className="text-sm text-pedra-500">{e.emergency_relationship}</p> : null}
                    {e.emergency_phone ? <p className="mt-1 text-sm font-bold text-pedra-700">{formatPhone(e.emergency_phone)}</p> : null}
                  </div>
                  {e.emergency_phone ? (
                    <div className="flex gap-2">
                      <a
                        href={`tel:+55${e.emergency_phone}`}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-erro px-4 text-sm font-bold text-white hover:bg-erro/90 sm:flex-none"
                      >
                        <PhoneIcon className="h-4 w-4" aria-hidden /> Ligar
                      </a>
                      {whatsappLink(e.emergency_phone) ? (
                        <a
                          href={whatsappLink(e.emergency_phone)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-pedra-300 bg-white px-4 text-sm font-bold text-ok hover:bg-ok-50 sm:flex-none"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-pedra-500">Nenhum contato de emergência informado.</p>
              )}
            </HighlightCard>

            <HighlightCard
              icon={<HeartPulse className="h-5 w-5" aria-hidden />}
              title="Saúde"
              tone="cirio"
              aside={canHealth ? <span className="hidden text-xs text-pedra-500 sm:inline">Consulta registrada no histórico</span> : null}
            >
              {!canHealth ? (
                <p className="flex items-start gap-2 text-sm text-pedra-600">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-pedra-400" aria-hidden />
                  Somente coordenadores autorizados consultam alergias e medicamentos. Peça a permissão a um administrador se precisar.
                </p>
              ) : healthError || !health ? (
                <Notice tone="erro">Não foi possível carregar as informações de saúde.</Notice>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Alergias', status: health.allergies_status, text: health.allergies },
                      { label: 'Medicamentos em uso', status: health.medications_status, text: health.medications },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          'rounded-lg border p-3',
                          item.status === 'possui' ? 'border-erro/30 bg-erro-50' : item.status === 'nao_possui' ? 'border-pedra-200 bg-pedra' : 'border-aviso/30 bg-aviso-50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-pedra-600">{item.label}</p>
                          <Badge tone={item.status === 'possui' ? 'erro' : item.status === 'nao_possui' ? 'ok' : 'aviso'}>{HEALTH_STATUS[item.status]}</Badge>
                        </div>
                        {item.status === 'possui' && item.text ? <p className="mt-2 whitespace-pre-line text-sm font-bold text-erro">{item.text}</p> : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-pedra-500">Outras observações de saúde</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm">{health.health_notes || <span className="text-pedra-400">Nenhuma</span>}</p>
                  </div>
                  {health.updated_at ? (
                    <p className="mt-3 text-xs text-pedra-500">
                      Atualizado em {formatDateTime(health.updated_at)}
                      {health.updated_by_name ? ` por ${health.updated_by_name}` : ''}
                    </p>
                  ) : null}
                  {canEdit ? (
                    <details className="group mt-4 rounded-lg border border-pedra-200">
                      <summary className="flex h-11 cursor-pointer list-none items-center px-3 text-sm font-bold text-manto [&::-webkit-details-marker]:hidden">
                        Atualizar saúde
                      </summary>
                      <div className="border-t border-pedra-100 p-3">
                        <EditHealthForm id={e.id} data={health} />
                      </div>
                    </details>
                  ) : null}
                </>
              )}
            </HighlightCard>
          </div>

          <div className="space-y-5">
            <Panel title="Cadastro">
              <DataList
                items={[
                  {
                    label: 'Presença',
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={ATTENDANCE[e.attendance_status]?.tone}>{ATTENDANCE[e.attendance_status]?.label}</Badge>
                        {e.attendance_at ? (
                          <span className="text-xs font-normal text-pedra-500">
                            {formatDateTime(e.attendance_at)} · {(e.attendance_by_profile as unknown as { full_name: string } | null)?.full_name ?? '—'}
                          </span>
                        ) : null}
                      </span>
                    ),
                  },
                  { label: 'Cadastrado em', value: formatDateTime(e.created_at) },
                  { label: 'Por', value: creator?.full_name ?? null },
                ]}
              />
            </Panel>
            <Panel title="Observações">
              <DataList
                items={[
                  { label: 'Da ficha física', value: e.form_notes ? <span className="whitespace-pre-line font-normal">{e.form_notes}</span> : null },
                  { label: 'Administrativas', value: e.admin_notes ? <span className="whitespace-pre-line font-normal">{e.admin_notes}</span> : null },
                ]}
              />
            </Panel>
            {canEdit ? (
              <Panel title="Situação da ficha">
                <FichaStatusForm id={e.id} status={e.status} />
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'grupo' ? (
        <Panel title="Tropa">
          <p className="text-sm">
            {assignment?.group?.name ? (
              <>
                Tropa atual: <strong>{assignment.group.name}</strong>
                <span className="text-pedra-500"> · desde {formatDateTime(assignment.assigned_at)}</span>
                <span className="mt-1 block text-pedra-600">Tenentes: {tenentes || 'nenhum definido'}</span>
              </>
            ) : (
              'Ainda sem tropa.'
            )}
          </p>
          {canGroups && e.status === 'ativo' ? (
            <div className="mt-4">
              {groups.length ? <GroupForm id={e.id} current={assignment?.group_id ?? null} groups={groups} /> : <p className="text-sm text-pedra-500">Nenhuma tropa criada ainda.</p>}
            </div>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'historico' ? (
        <Panel title="Histórico de alterações">
          <HistoryList entries={history} groups={groupNames} />
        </Panel>
      ) : null}

      {tab === 'editar' ? (
        <Panel>
          <EditEncontristaForm
            data={{
              ...(e as unknown as EncontristaData),
              full_name: person.full_name,
              phone: person.phone,
              birth_date: person.birth_date,
            }}
            sizes={camp?.shirt_sizes ?? []}
          />
        </Panel>
      ) : null}
    </>
  );
}
