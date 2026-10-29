import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { can, canSeeServidores, coordinatesTeam, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, DataList, Notice, Tabs } from '@/components/ui/layout';
import { HistoryList } from '@/components/HistoryList';
import { ageOn, formatDate, formatDateTime, formatPhone, whatsappLink } from '@/lib/format';
import { MEMBERSHIP_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SOURCE_LABEL } from '@/lib/labels';
import { formatBRL } from '@/lib/money';
import { listDocuments } from '@/lib/documents';
import { DocumentList } from '@/components/DocumentList';
import { PaymentForm, PaymentReview, type PaymentData } from '../PaymentForms';
import { EditServidorForm, type ServidorData } from '../ServidorForm';
import { MoveForm, StatusForm } from './ServidorActions';

export const metadata: Metadata = { title: 'Soldado/servo' };

export default async function ServidorPage({ params, searchParams }: { params: { id: string }; searchParams: { aba?: string; novo?: string } }) {
  const access = await requireCheck(canSeeServidores);
  const supabase = createClient();
  const { data: m } = await supabase
    .from('service_team_memberships')
    .select(
      'id, camp_id, team_id, person_id, status, shirt_size, extra_answers, admin_notes, source, consent_at, created_at, cancelled_at, cancel_reason, payment_status, payment_expected, payment_paid, payment_date, payment_method, payment_notes, payment_confirmed_at, payment_updated_at, confirmer:profiles!service_team_memberships_payment_confirmed_by_fkey(full_name), team:service_teams(name), person:people(full_name, phone, birth_date)',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!m) notFound();

  const camp = await getActiveCamp();
  const person = m.person as unknown as { full_name: string; phone: string | null; birth_date: string | null };
  const team = m.team as unknown as { name: string };
  const editable = camp?.id === m.camp_id && campEditable(camp);
  const canEdit = editable && (can(access, 'servidores.editar_todos') || coordinatesTeam(access, m.team_id));
  const canMove = editable && can(access, 'equipes.gerenciar');
  const canPayment = can(access, 'financeiro.gerenciar') || coordinatesTeam(access, m.team_id);
  const isFinance = can(access, 'financeiro.gerenciar');
  const tab =
    searchParams.aba === 'historico'
      ? 'historico'
      : searchParams.aba === 'editar' && canEdit
        ? 'editar'
        : searchParams.aba === 'pagamento' && canPayment
          ? 'pagamento'
          : 'dados';
  const docs = tab === 'pagamento' ? await listDocuments('pagamento', m.id) : [];
  const confirmer = m.confirmer as unknown as { full_name: string } | null;
  const payLocked = !isFinance && ['confirmado', 'estornado'].includes(m.payment_status);
  const fields = camp?.signup_fields ?? [];
  const st = MEMBERSHIP_STATUS[m.status];
  const wa = whatsappLink(person.phone);

  let history: Parameters<typeof HistoryList>[0]['entries'] = [];
  let teamNames: Record<string, string> = {};
  if (tab === 'historico') {
    const [{ data: h }, { data: ts }] = await Promise.all([
      supabase.rpc('record_history', { p_entity: 'servidor', p_id: m.id }),
      supabase.from('service_teams').select('id, name').eq('camp_id', m.camp_id),
    ]);
    history = (h ?? []) as typeof history;
    teamNames = Object.fromEntries((ts ?? []).map((t) => [t.id, t.name]));
  }
  const moveTeams = canMove
    ? ((await supabase.from('service_teams_overview').select('id, name, available').eq('camp_id', m.camp_id).neq('status', 'inativa').neq('id', m.team_id).order('name')).data ?? [])
    : [];

  const base = `/servidores/${m.id}`;
  const age = ageOn(person.birth_date);

  return (
    <>
      <PageHeader
        title={person.full_name}
        description={
          <>
            Soldado/servo na equipe{' '}
            <Link href={`/equipes/${m.team_id}`} className="font-bold text-manto hover:underline">
              {team.name}
            </Link>
          </>
        }
        back={{ href: '/servidores', label: 'Soldados/Servos' }}
        actions={st ? <Badge tone={st.tone}>Inscrição {st.label.toLowerCase()}</Badge> : null}
      />
      {searchParams.novo ? (
        <Notice tone="ok" className="mb-5">
          Soldado/servo cadastrado.
        </Notice>
      ) : null}
      <Tabs
        current={tab}
        items={[
          { key: 'dados', label: 'Dados', href: base },
          ...(canPayment ? [{ key: 'pagamento', label: 'Pagamento', href: `${base}?aba=pagamento` }] : []),
          ...(canEdit ? [{ key: 'editar', label: 'Editar', href: `${base}?aba=editar` }] : []),
          { key: 'historico', label: 'Histórico', href: `${base}?aba=historico` },
        ]}
      />

      {tab === 'editar' ? (
        <Panel>
          <EditServidorForm
            data={{ ...(m as unknown as ServidorData), full_name: person.full_name, phone: person.phone, birth_date: person.birth_date }}
            sizes={camp?.shirt_sizes ?? []}
            fields={fields}
          />
        </Panel>
      ) : tab === 'pagamento' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Panel title="Pagamento" actions={<Badge tone={PAYMENT_STATUS[m.payment_status]?.tone}>{PAYMENT_STATUS[m.payment_status]?.label}</Badge>}>
              <DataList
                items={[
                  { label: 'Valor combinado', value: m.payment_expected !== null ? formatBRL(m.payment_expected) : null },
                  { label: 'Valor pago', value: m.payment_paid !== null ? formatBRL(m.payment_paid) : null },
                  { label: 'Data do pagamento', value: m.payment_date ? formatDate(m.payment_date) : null },
                  { label: 'Forma', value: m.payment_method ? PAYMENT_METHOD[m.payment_method] : null },
                  ...(m.payment_status === 'confirmado'
                    ? [{ label: 'Confirmado por', value: `${confirmer?.full_name ?? '—'} em ${formatDateTime(m.payment_confirmed_at)}` }]
                    : []),
                  ...(m.payment_expected !== null && m.payment_paid !== null && Number(m.payment_paid) < Number(m.payment_expected)
                    ? [{ label: 'Falta pagar', value: <span className="text-aviso">{formatBRL(Number(m.payment_expected) - Number(m.payment_paid))}</span> }]
                    : []),
                ]}
              />
              {m.payment_notes ? <p className="mt-4 whitespace-pre-line border-t border-pedra-100 pt-4 text-sm">{m.payment_notes}</p> : null}
            </Panel>
            {editable && !payLocked ? (
              <Panel title="Registrar pagamento">
                <PaymentForm data={m as unknown as PaymentData} />
              </Panel>
            ) : payLocked ? (
              <Notice>Pagamento já conferido pelo financeiro. Para corrigir, fale com quem cuida do financeiro.</Notice>
            ) : null}
          </div>
          <div className="space-y-5">
            {isFinance && editable ? (
              <Panel title="Conferência do financeiro" description="Só pagamentos confirmados entram nas receitas.">
                <PaymentReview id={m.id} status={m.payment_status} />
              </Panel>
            ) : null}
            <Panel title="Comprovantes" description="Abrem por um link temporário.">
              <DocumentList docs={docs} />
            </Panel>
          </div>
        </div>
      ) : tab === 'historico' ? (
        <Panel title="Histórico de alterações">
          <HistoryList entries={history} teams={teamNames} />
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Panel title="Dados pessoais">
              <DataList
                items={[
                  { label: 'Nome completo', value: person.full_name },
                  {
                    label: 'Telefone',
                    value: person.phone ? (
                      <span className="flex items-center gap-2">
                        <a href={`tel:+55${person.phone}`} className="text-manto hover:underline">
                          {formatPhone(person.phone)}
                        </a>
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="text-ok" aria-label="Abrir no WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        ) : null}
                      </span>
                    ) : null,
                  },
                  { label: 'Nascimento', value: person.birth_date ? `${formatDate(person.birth_date)}${age !== null ? ` (${age} anos)` : ''}` : null },
                  { label: 'Camiseta', value: m.shirt_size },
                ]}
              />
            </Panel>
            {fields.length ? (
              <Panel title="Informações adicionais">
                <DataList items={fields.map((f) => ({ label: f.label, value: (m.extra_answers as Record<string, string>)?.[f.key] ?? null }))} />
              </Panel>
            ) : null}
            <Panel title="Inscrição">
              <DataList
                items={[
                  { label: 'Data da inscrição', value: formatDateTime(m.created_at) },
                  { label: 'Origem', value: SOURCE_LABEL[m.source] ?? m.source },
                  { label: 'Consentimento', value: m.consent_at ? `Aceito em ${formatDateTime(m.consent_at)}` : m.source === 'cadastro_interno' ? 'Cadastro feito pela coordenação' : null },
                  ...(m.status === 'cancelada'
                    ? [
                        { label: 'Cancelada em', value: formatDateTime(m.cancelled_at) },
                        { label: 'Motivo', value: m.cancel_reason },
                      ]
                    : []),
                ]}
              />
              {m.admin_notes ? (
                <div className="mt-4 border-t border-pedra-100 pt-4">
                  <p className="text-xs text-pedra-500">Observações administrativas</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm">{m.admin_notes}</p>
                </div>
              ) : null}
            </Panel>
          </div>
          {canEdit || canMove ? (
            <div className="space-y-5">
              {canEdit ? (
                <Panel title={m.status === 'cancelada' ? 'Reativar' : 'Cancelar inscrição'}>
                  <StatusForm id={m.id} status={m.status} />
                </Panel>
              ) : null}
              {canMove && m.status === 'ativa' ? (
                <Panel title="Transferir de equipe">
                  {moveTeams.length ? <MoveForm id={m.id} teams={moveTeams} /> : <p className="text-sm text-pedra-500">Não há outra equipe disponível.</p>}
                </Panel>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
