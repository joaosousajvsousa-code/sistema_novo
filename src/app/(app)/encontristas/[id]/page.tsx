import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HeartPulse, Lock, MessageCircle } from 'lucide-react';
import { can, requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, DataList, Notice, Tabs, EmptyState } from '@/components/ui/layout';
import { HistoryList } from '@/components/HistoryList';
import { ageOn, formatDate, formatDateTime, formatPhone, whatsappLink } from '@/lib/format';
import { ENCONTRISTA_STATUS, HEALTH_STATUS } from '@/lib/labels';
import { EditEncontristaForm, EditHealthForm, type EncontristaData, type HealthData } from '../EncontristaForm';
import { FichaStatusForm, GroupForm } from './FichaActions';

export const metadata: Metadata = { title: 'Ficha do recruta' };

const TABS = ['dados', 'emergencia', 'saude', 'grupo', 'historico', 'editar'] as const;
type Tab = (typeof TABS)[number];

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
      'id, camp_id, person_id, status, shirt_size, emergency_name, emergency_phone, emergency_relationship, form_notes, admin_notes, created_at, creator:profiles!encontristas_created_by_fkey(full_name), person:people(full_name, phone, birth_date), assignment:participant_group_assignments(group_id, assigned_at, group:participant_groups(name))',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!e) notFound();

  const camp = await getActiveCamp();
  const editable = camp?.id === e.camp_id && campEditable(camp);
  const canEdit = editable && can(access, 'encontristas.editar');
  const canHealth = can(access, 'saude.ver');
  const canGroups = editable && can(access, 'grupos.gerenciar');
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

  // Saúde: só busca quando a aba é aberta (cada leitura fica registrada).
  type HealthView = HealthData & { updated_at: string | null; updated_by_name: string | null };
  let health: HealthView | null = null;
  let healthError = false;
  if (tab === 'saude' && canHealth) {
    const { data, error } = await supabase.rpc('get_encontrista_health', { p_id: e.id });
    health = (data as HealthView | null) ?? null;
    healthError = Boolean(error);
  }

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
          { key: 'emergencia', label: 'Emergência', href: `${base}?aba=emergencia` },
          { key: 'saude', label: 'Saúde', href: `${base}?aba=saude` },
          { key: 'grupo', label: 'Tropa', href: `${base}?aba=grupo` },
          { key: 'historico', label: 'Histórico', href: `${base}?aba=historico` },
          ...(canEdit ? [{ key: 'editar', label: 'Editar', href: `${base}?aba=editar` }] : []),
        ]}
      />

      {tab === 'dados' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <Panel title="Dados pessoais">
              <DataList
                items={[
                  { label: 'Nome completo', value: person.full_name },
                  { label: 'Telefone', value: <Phone value={person.phone} /> },
                  { label: 'Nascimento', value: person.birth_date ? `${formatDate(person.birth_date)}${age !== null ? ` (${age} anos)` : ''}` : null },
                  { label: 'Camiseta', value: e.shirt_size },
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
          </div>
          <div className="space-y-5">
            <Panel title="Cadastro">
              <DataList
                items={[
                  { label: 'Cadastrado em', value: formatDateTime(e.created_at) },
                  { label: 'Por', value: creator?.full_name ?? null },
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

      {tab === 'emergencia' ? (
        <Panel title="Contato de emergência">
          <DataList
            items={[
              { label: 'Nome', value: e.emergency_name },
              { label: 'Telefone', value: <Phone value={e.emergency_phone} /> },
              { label: 'Parentesco ou relação', value: e.emergency_relationship },
            ]}
          />
        </Panel>
      ) : null}

      {tab === 'saude' ? (
        !canHealth ? (
          <div className="rounded-lg border border-pedra-200 bg-white">
            <EmptyState
              icon={<Lock className="h-8 w-8" />}
              title="Informações de saúde restritas"
              description="Somente coordenadores autorizados consultam alergias e medicamentos. Peça a permissão a um administrador se precisar."
            />
          </div>
        ) : healthError || !health ? (
          <Notice tone="erro">Não foi possível carregar as informações de saúde.</Notice>
        ) : (
          <div className="space-y-5">
            <Notice tone="manto">
              <span className="inline-flex items-center gap-2">
                <HeartPulse className="h-4 w-4" aria-hidden /> Dados sensíveis. Esta consulta fica registrada no histórico.
              </span>
            </Notice>
            <Panel title="Informações de saúde">
              <dl className="grid gap-5 sm:grid-cols-2">
                {[
                  { label: 'Alergias', status: health.allergies_status, text: health.allergies },
                  { label: 'Medicamentos em uso', status: health.medications_status, text: health.medications },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-pedra-500">{item.label}</dt>
                    <dd className="mt-1">
                      <Badge tone={item.status === 'possui' ? 'erro' : item.status === 'nao_possui' ? 'ok' : 'aviso'}>{HEALTH_STATUS[item.status]}</Badge>
                      {item.status === 'possui' && item.text ? <p className="mt-1.5 whitespace-pre-line text-sm font-bold">{item.text}</p> : null}
                    </dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="text-xs text-pedra-500">Outras observações de saúde</dt>
                  <dd className="mt-1 whitespace-pre-line text-sm">{health.health_notes || <span className="text-pedra-400">Nenhuma</span>}</dd>
                </div>
              </dl>
              {health.updated_at ? (
                <p className="mt-4 text-xs text-pedra-500">
                  Atualizado em {formatDateTime(health.updated_at)}
                  {health.updated_by_name ? ` por ${health.updated_by_name}` : ''}
                </p>
              ) : null}
            </Panel>
            {canEdit ? (
              <Panel title="Atualizar saúde">
                <EditHealthForm id={e.id} data={health} />
              </Panel>
            ) : null}
          </div>
        )
      ) : null}

      {tab === 'grupo' ? (
        <Panel title="Tropa">
          <p className="text-sm">
            {assignment?.group?.name ? (
              <>
                Tropa atual: <strong>{assignment.group.name}</strong>
                <span className="text-pedra-500"> · desde {formatDateTime(assignment.assigned_at)}</span>
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
