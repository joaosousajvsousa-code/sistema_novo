import type { Metadata } from 'next';
import { Search } from 'lucide-react';
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
  service_team_memberships: 'Inscrições de servidores',
  encontristas: 'Fichas de encontristas',
  participant_health: 'Saúde',
  participant_groups: 'Grupos',
  participant_group_assignments: 'Distribuição em grupos',
};

const ACTIONS: Record<string, { label: string; tone: 'ok' | 'manto' | 'erro' | 'cirio' | 'neutral' }> = {
  INSERT: { label: 'Criação', tone: 'ok' },
  UPDATE: { label: 'Alteração', tone: 'manto' },
  DELETE: { label: 'Exclusão', tone: 'erro' },
  VIEW_HEALTH: { label: 'Consulta de saúde', tone: 'cirio' },
  REVOKE_SESSIONS: { label: 'Sessões encerradas', tone: 'neutral' },
};

const PAGE = 50;
const HIDE = new Set(['id', 'camp_id', 'created_at', 'updated_by', 'person_id']);

function summarize(before: Record<string, unknown> | null, after: Record<string, unknown> | null, entity: string) {
  if (entity === 'participant_health') {
    const campos = (after?.campos as string[] | undefined) ?? [];
    return campos.length ? `Campos: ${campos.filter((c) => !HIDE.has(c) && c !== 'encontrista_id').join(', ')} (valores não registrados)` : '';
  }
  const src = after ?? before ?? {};
  const keys = Object.keys(src).filter((k) => !HIDE.has(k));
  return keys
    .slice(0, 6)
    .map((k) => {
      const v = src[k];
      const txt = v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}: ${txt.length > 40 ? `${txt.slice(0, 40)}…` : txt}`;
    })
    .join(' · ');
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
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-manto px-4 text-sm font-bold text-white">
          <Search className="h-4 w-4" /> Filtrar
        </button>
      </form>
      <div className="rounded-lg border border-pedra-200 bg-white">
        {error ? (
          <EmptyState title="Não foi possível carregar a auditoria" />
        ) : !rows?.length ? (
          <EmptyState title="Nenhum registro encontrado" />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {rows.map((r) => {
              const a = ACTIONS[r.action] ?? { label: r.action, tone: 'neutral' as const };
              return (
                <li key={r.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.tone}>{a.label}</Badge>
                    <span className="text-sm font-bold">{ENTITIES[r.entity] ?? r.entity}</span>
                    <span className="text-xs text-pedra-500">
                      {formatDateTime(r.created_at)} · {r.user_id ? names[r.user_id] ?? 'Usuário removido' : 'Link público / sistema'}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-pedra-600">{summarize(r.before, r.after, r.entity)}</p>
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
