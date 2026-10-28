import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, UserPlus, UserRound } from 'lucide-react';
import { can, requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice, Pagination } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { formatPhone, onlyDigits } from '@/lib/format';
import { PAGE_SIZE } from '@/config/app';

export const metadata: Metadata = { title: 'Recrutas' };

type SP = { q?: string; grupo?: string; status?: string; tamanho?: string; pagina?: string };

function normalize(q: string) {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[%_]/g, '');
}

export default async function EncontristasPage({ searchParams }: { searchParams: SP }) {
  const access = await requirePerm('encontristas.ver');
  const camp = await getActiveCamp();
  if (!camp) {
    return (
      <>
        <PageHeader title="Recrutas" />
        <Notice>Nenhum acampamento ativo.</Notice>
      </>
    );
  }
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status === 'cancelado' ? 'cancelado' : 'ativo';

  let query = supabase
    .from('encontristas_list')
    .select('id, full_name, phone, group_id, group_name, shirt_size, status', { count: 'exact' })
    .eq('camp_id', camp.id)
    .eq('status', status)
    .order('full_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (searchParams.grupo === 'sem') query = query.is('group_id', null);
  else if (searchParams.grupo) query = query.eq('group_id', searchParams.grupo);
  if (searchParams.tamanho === 'sem') query = query.is('shirt_size', null);
  else if (searchParams.tamanho) query = query.eq('shirt_size', searchParams.tamanho);
  if (q) {
    const digits = onlyDigits(q);
    if (digits.length >= 4 && digits.length === q.replace(/[\s()+-]/g, '').length) query = query.ilike('phone', `%${digits}%`);
    else query = query.ilike('name_normalized', `%${normalize(q)}%`);
  }

  const [{ data: rows, count, error }, { data: groups }] = await Promise.all([
    query,
    supabase.from('participant_groups').select('id, name').eq('camp_id', camp.id).order('name'),
  ]);

  const canCreate = can(access, 'encontristas.editar') && campEditable(camp);
  const hasFilters = Boolean(q || searchParams.grupo || searchParams.tamanho || searchParams.status);
  const params = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => v && k !== 'pagina') as [string, string][]);

  return (
    <>
      <PageHeader
        title="Recrutas"
        description={count !== null ? `${count} ${status === 'cancelado' ? 'ficha(s) cancelada(s)' : 'recruta(s)'}` : undefined}
        actions={
          canCreate ? (
            <ButtonLink href="/encontristas/novo">
              <UserPlus className="h-4 w-4" /> Cadastrar recruta
            </ButtonLink>
          ) : null
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_140px_140px_auto]" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar por nome ou telefone
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Nome ou telefone" />
        <label htmlFor="grupo" className="sr-only">
          Tropa
        </label>
        <Select id="grupo" name="grupo" defaultValue={searchParams.grupo ?? ''}>
          <option value="">Todas as tropas</option>
          <option value="sem">Sem tropa</option>
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <label htmlFor="tamanho" className="sr-only">
          Tamanho
        </label>
        <Select id="tamanho" name="tamanho" defaultValue={searchParams.tamanho ?? ''}>
          <option value="">Todos os tamanhos</option>
          {camp.shirt_sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="sem">Sem tamanho</option>
        </Select>
        <label htmlFor="status" className="sr-only">
          Situação
        </label>
        <Select id="status" name="status" defaultValue={searchParams.status ?? ''}>
          <option value="">Ativos</option>
          <option value="cancelado">Cancelados</option>
        </Select>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-manto px-4 text-sm font-bold text-white">
          <Search className="h-4 w-4" /> Filtrar
        </button>
      </form>
      <div className="rounded-lg border border-pedra-200 bg-white">
        {error ? (
          <EmptyState title="Não foi possível carregar os recrutas" description="Verifique a conexão e recarregue a página." />
        ) : !rows?.length ? (
          <EmptyState
            icon={<UserRound className="h-8 w-8" />}
            title={hasFilters ? 'Nenhum recruta encontrado com esses filtros' : 'Nenhum recruta cadastrado'}
            description={hasFilters ? undefined : 'Cadastre as fichas físicas aqui. A distribuição em tropas vem depois.'}
            action={
              hasFilters ? (
                <ButtonLink href="/encontristas" variant="secondary" size="sm">
                  Limpar filtros
                </ButtonLink>
              ) : canCreate ? (
                <ButtonLink href="/encontristas/novo" size="sm">
                  Cadastrar a primeira ficha
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_160px_180px_90px] gap-4 border-b border-pedra-200 px-5 py-2 text-xs text-pedra-500 md:grid">
              <span>Nome</span>
              <span>Telefone</span>
              <span>Tropa</span>
              <span>Camiseta</span>
            </div>
            <ul className="divide-y divide-pedra-100">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/encontristas/${r.id}`}
                    className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-pedra-100/60 md:grid-cols-[1fr_160px_180px_90px] md:items-center md:gap-4 md:px-5"
                  >
                    <span className="truncate font-bold">{r.full_name}</span>
                    <span className="text-right text-sm md:order-last md:text-left">{r.shirt_size ?? <Badge tone="aviso">—</Badge>}</span>
                    <span className="text-sm text-pedra-600">{formatPhone(r.phone) || '—'}</span>
                    <span className="truncate text-sm max-md:col-span-2">
                      {r.group_name ? <span className="text-pedra-700">{r.group_name}</span> : <Badge tone="aviso">Sem tropa</Badge>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={count ?? 0}
        makeHref={(p) => {
          const sp = new URLSearchParams(params);
          sp.set('pagina', String(p));
          return `/encontristas?${sp.toString()}`;
        }}
      />
    </>
  );
}
