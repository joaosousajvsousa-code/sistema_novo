import type { Metadata } from 'next';
import { Globe, Search } from 'lucide-react';
import { Initials } from '@/components/Initials';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState, Pagination, Badge } from '@/components/ui/layout';
import { Select } from '@/components/ui/input';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Auditoria' };

const ENTITIES: Record<string, string> = {
  profiles: 'Usuários',
  user_roles: 'Perfis de acesso',
  user_permissions: 'Permissões',
  camps: 'Acampamento',
  service_teams: 'Equipes',
  service_team_coordinators: 'Coordenadores de equipe',
  people: 'Dados pessoais',
  service_team_memberships: 'Inscrições de soldados/servos',
  encontristas: 'Fichas de recrutas',
  participant_health: 'Saúde',
  participant_groups: 'Tropas',
  participant_group_assignments: 'Distribuição em tropas',
  participant_group_leaders: 'Tenentes das tropas',
  schedule_items: 'Cronograma',
  finance_entries: 'Receitas e despesas',
  finance_categories: 'Categorias financeiras',
  finance_budgets: 'Orçamento',
  private_documents: 'Comprovantes',
  shirt_orders: 'Pedidos de camiseta',
  medication_plans: 'Remédios',
  medication_doses: 'Doses de remédio',
};

// Nomes dos campos em português (os demais ficam de fora do resumo).
const FIELDS: Record<string, string> = {
  full_name: 'nome', name: 'nome', phone: 'telefone', birth_date: 'nascimento', status: 'situação', shirt_size: 'camiseta',
  capacity: 'vagas', title: 'título', location: 'local', planned_start: 'início previsto', planned_end: 'término previsto',
  actual_start: 'início real', actual_end: 'término real', amount: 'valor', description: 'descrição', kind: 'tipo',
  payment_status: 'pagamento', payment_paid: 'valor pago', payment_expected: 'valor combinado', payment_method: 'forma',
  attendance_status: 'presença', medication: 'remédio', dose: 'dose', times: 'horários', note: 'observação', active: 'ativo',
  version: 'versão', start_date: 'início', end_date: 'término', emergency_name: 'contato de emergência', username: 'usuário',
  photo_path: 'foto', image: 'imagem', bank_balance: 'saldo no banco', file_name: 'arquivo', cancel_reason: 'motivo',
  dose_date: 'dia', dose_time: 'horário', role_key: 'perfil', permission_key: 'permissão', must_change_password: 'troca de senha',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const ISO = /^\d{4}-\d{2}-\d{2}T/;

const ACTIONS: Record<string, { label: string; tone: 'ok' | 'manto' | 'erro' | 'cirio' | 'neutral' }> = {
  INSERT: { label: 'Criação', tone: 'ok' },
  UPDATE: { label: 'Alteração', tone: 'manto' },
  DELETE: { label: 'Exclusão', tone: 'erro' },
  VIEW_HEALTH: { label: 'Consulta de saúde', tone: 'cirio' },
  VIEW_DOCUMENT: { label: 'Comprovante aberto', tone: 'neutral' },
  BANK_BALANCE: { label: 'Saldo do banco', tone: 'manto' },
  REVOKE_SESSIONS: { label: 'Sessões encerradas', tone: 'neutral' },
};

const PAGE = 50;
const HIDE = new Set(['id', 'camp_id', 'created_at', 'updated_by', 'person_id']);

function summarize(before: Record<string, unknown> | null, after: Record<string, unknown> | null, entity: string) {
  if (entity === 'participant_health') {
    const campos = (after?.campos as string[] | undefined) ?? [];
    return campos.length ? `Campos: ${campos.filter((c) => !HIDE.has(c) && c !== 'encontrista_id').join(', ')} (valores não registrados)` : '';
  }
  // Em alterações, mostra só o que mudou; em criações, os campos principais.
  const src = after ?? before ?? {};
  const changed = before && after ? Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k])) : Object.keys(src);
  const parts = changed
    .filter((k) => FIELDS[k])
    .map((k) => {
      const v = src[k];
      if (k === 'photo_path' || k === 'image') return `${FIELDS[k]} ${v ? 'atualizada' : 'removida'}`;
      if (v === null || v === undefined || v === '') return `${FIELDS[k]}: —`;
      if (typeof v === 'string' && UUID.test(v)) return null;
      const txt = typeof v === 'boolean' ? (v ? 'sim' : 'não') : typeof v === 'string' && ISO.test(v) ? formatDateTime(v) : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? '…' : String(v);
      return `${FIELDS[k]}: ${txt.length > 50 ? `${txt.slice(0, 50)}…` : txt}`;
    })
    .filter(Boolean)
    .slice(0, 5);
  return parts.join(' · ');
}

export default async function AuditoriaPage({ searchParams }: { searchParams: { area?: string; acao?: string; pagina?: string } }) {
  await requirePerm('auditoria.ver');
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  let q = supabase
    .from('audit_logs')
    .select('id, created_at, action, entity, entity_id, before, after, user_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (searchParams.area && ENTITIES[searchParams.area]) q = q.eq('entity', searchParams.area);
  if (searchParams.acao && ACTIONS[searchParams.acao]) q = q.eq('action', searchParams.acao);
  const { data: rows, count, error } = await q;

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
  const { data: users } = userIds.length ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
  const names = Object.fromEntries((users ?? []).map((u) => [u.id, u.full_name]));

  return (
    <>
      <PageHeader title="Auditoria" description="Registro das operações sensíveis. Ninguém pode editar ou apagar estes registros." />
      <form className="mb-4 grid gap-2 sm:grid-cols-[220px_220px_auto] sm:justify-start">
        <label htmlFor="area" className="sr-only">
          Área
        </label>
        <Select id="area" name="area" defaultValue={searchParams.area ?? ''}>
          <option value="">Todas as áreas</option>
          {Object.entries(ENTITIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label htmlFor="acao" className="sr-only">
          Ação
        </label>
        <Select id="acao" name="acao" defaultValue={searchParams.acao ?? ''}>
          <option value="">Todas as ações</option>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-manto px-4 text-sm font-bold text-white shadow-[0_8px_18px_-10px_rgba(61,74,42,0.9)]">
          <Search className="h-4 w-4" /> Filtrar
        </button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-22px_rgba(21,32,46,0.45)]">
        {error ? (
          <EmptyState title="Não foi possível carregar a auditoria" />
        ) : !rows?.length ? (
          <EmptyState title="Nenhum registro encontrado" />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {rows.map((r) => {
              const a = ACTIONS[r.action] ?? { label: r.action, tone: 'neutral' as const };
              return (
                <li key={r.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  {r.user_id ? <Initials name={names[r.user_id] ?? '?'} className="h-10 w-10 text-xs" /> : <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pedra-100 text-pedra-400"><Globe className="h-4 w-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{r.user_id ? names[r.user_id] ?? 'Usuário removido' : 'Link público / sistema'}</span>
                      <Badge tone={a.tone}>{a.label}</Badge>
                      <span className="text-sm text-pedra-700">{ENTITIES[r.entity] ?? r.entity}</span>
                    </div>
                    {summarize(r.before, r.after, r.entity) ? <p className="mt-1 break-words text-xs text-pedra-600">{summarize(r.before, r.after, r.entity)}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-pedra-400">{formatDateTime(r.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Pagination
        page={page}
        pageSize={PAGE}
        total={count ?? 0}
        makeHref={(p) => {
          const sp = new URLSearchParams();
          if (searchParams.area) sp.set('area', searchParams.area);
          if (searchParams.acao) sp.set('acao', searchParams.acao);
          sp.set('pagina', String(p));
          return `/auditoria?${sp.toString()}`;
        }}
      />
    </>
  );
}
