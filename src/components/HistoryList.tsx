import { formatDateTime } from '@/lib/format';

type Entry = { created_at: string; action: string; entity: string; user_name: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null };

const ENTITY: Record<string, string> = {
  people: 'Dados pessoais',
  service_team_memberships: 'Inscrição',
  encontristas: 'Ficha',
  participant_health: 'Saúde',
  participant_group_assignments: 'Grupo',
};

const FIELD: Record<string, string> = {
  full_name: 'nome',
  phone: 'telefone',
  birth_date: 'nascimento',
  shirt_size: 'camiseta',
  admin_notes: 'observações administrativas',
  extra_answers: 'informações adicionais',
  status: 'situação',
  team_id: 'equipe',
  cancel_reason: 'motivo do cancelamento',
  cancelled_at: 'data do cancelamento',
  cancelled_by: 'cancelado por',
  emergency_name: 'contato de emergência',
  emergency_phone: 'telefone de emergência',
  emergency_relationship: 'parentesco',
  form_notes: 'observações da ficha',
  allergies: 'alergias',
  allergies_status: 'alergias',
  medications: 'medicamentos',
  medications_status: 'medicamentos',
  health_notes: 'observações de saúde',
  group_id: 'grupo',
  payment_status: 'pagamento',
};

const HIDDEN = new Set(['id', 'camp_id', 'person_id', 'created_at', 'created_by', 'updated_by', 'assigned_at', 'assigned_by', 'encontrista_id', 'consent_at', 'source', 'cancelled_by']);

function describe(e: Entry, groups: Record<string, string>, teams: Record<string, string>) {
  const area = ENTITY[e.entity] ?? e.entity;
  if (e.action === 'VIEW_HEALTH') return 'Consultou as informações de saúde';
  if (e.entity === 'participant_group_assignments') {
    const to = e.after?.group_id as string | undefined;
    if (e.action === 'DELETE') return 'Removido do grupo';
    return `Grupo definido: ${(to && groups[to]) || 'outro grupo'}`;
  }
  if (e.action === 'INSERT') return `${area}: cadastro criado`;
  if (e.action === 'DELETE') return `${area}: registro removido`;
  const keys =
    e.entity === 'participant_health'
      ? ((e.after?.campos as string[]) ?? [])
      : Object.keys(e.after ?? {});
  const fields = Array.from(new Set(keys.filter((k) => !HIDDEN.has(k)).map((k) => FIELD[k] ?? k)));
  if (e.entity === 'service_team_memberships' && e.after?.team_id) {
    const t = teams[e.after.team_id as string];
    return `Transferido para a equipe ${t ?? 'nova'}`;
  }
  if (e.entity === 'service_team_memberships' && e.after?.status) {
    return e.after.status === 'cancelada' ? 'Inscrição cancelada' : 'Inscrição reativada';
  }
  return fields.length ? `${area}: alterou ${fields.join(', ')}` : `${area}: alteração`;
}

export function HistoryList({
  entries,
  groups = {},
  teams = {},
}: {
  entries: Entry[];
  groups?: Record<string, string>;
  teams?: Record<string, string>;
}) {
  if (!entries.length) return <p className="text-sm text-pedra-500">Nenhuma alteração registrada.</p>;
  return (
    <ol className="relative space-y-4 border-l border-pedra-200 pl-5">
      {entries.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-manto" aria-hidden />
          <p className="text-sm font-bold text-pedra-900">{describe(e, groups, teams)}</p>
          <p className="text-xs text-pedra-500">
            {formatDateTime(e.created_at)} · {e.user_name ?? 'Inscrição pelo link público'}
          </p>
        </li>
      ))}
    </ol>
  );
}
