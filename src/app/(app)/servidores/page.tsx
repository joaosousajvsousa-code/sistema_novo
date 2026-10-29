import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, UserPlus, Users } from 'lucide-react';
import { can, canSeeServidores, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice, Pagination } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { formatPhone, onlyDigits } from '@/lib/format';
import { PAYMENT_STATUS } from '@/lib/labels';
import { PAGE_SIZE } from '@/config/app';

export const metadata: Metadata = { title: 'Soldados/Servos' };

type SP = { q?: string; equipe?: string; status?: string; tamanho?: string; pagamento?: string; pagina?: string };

export default async function ServidoresPage({ searchParams }: { searchParams: SP }) {
  const access = await requireCheck(canSeeServidores);
  const camp = await getActiveCamp();
  if (!camp) {
    return (
      <>
        <PageHeader title="Soldados/Servos" />
        <Notice>Nenhum acampamento ativo.</Notice>
      </>
    );
  }
  const supabase = createClient();
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status === 'cancelada' ? 'cancelada' : searchParams.status === 'todas' ? null : 'ativa';

  let query = supabase
    .from('servidores_list')
    .select('id, full_name, phone, team_id, team_name, shirt_size, status, payment_status', { count: 'exact' })
    .eq('camp_id', camp.id)
    .order('full_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq('status', status);
  if (searchParams.equipe) query = query.eq('team_id', searchParams.equipe);
  if (searchParams.pagamento === 'a_conferir') query = query.in('payment_status', ['comprovante_enviado', 'em_analise']);
  else if (searchParams.pagamento && PAYMENT_STATUS[searchParams.pagamento]) query = query.eq('payment_status', searchParams.pagamento);
  if (searchParams.tamanho === 'sem') query = query.is('shirt_size', null);
  else if (searchParams.tamanho) query = query.eq('shirt_size', searchParams.tamanho);
  if (q) {
    const digits = onlyDigits(q);
    if (digits.length >= 4 && digits.length === q.replace(/[\s()+-]/g, '').length) query = query.ilike('phone', `%${digits}%`);
    else
      query = query.ilike(
        'name_normalized',
        `%${q
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[%_]/g, '')}%`,
      );
  }

  const [{ data: rows, count, error }, { data: teams }] = await Promise.all([
    query,
    supabase.from('service_teams').select('id, name').eq('camp_id', camp.id).order('name'),
  ]);

  const canCreate =
    campEditable(camp) && (can(access, 'servidores.editar_todos') || can(access, 'equipes.gerenciar') || access.coordinatedTeamIds.length > 0);
  const params = new URLSearchParams(Object.entries(searchParams).filter(([k, v]) => v && k !== 'pagina') as [string, string][]);
  const hasFilters = Boolean(q || searchParams.equipe || searchParams.tamanho || searchParams.status || searchParams.pagamento);

  return (
    <>
      <PageHeader
        title="Soldados/Servos"
        description={count !== null ? `${count} ${status === 'cancelada' ? 'inscrição(ões) cancelada(s)' : 'soldado(s)/servo(s)'}` : undefined}
        actions={
          canCreate ? (
            <ButtonLink href={searchParams.equipe ? `/servidores/novo?equipe=${searchParams.equipe}` : '/servidores/novo'}>
              <UserPlus className="h-4 w-4" /> Cadastrar soldado/servo
            </ButtonLink>
          ) : null
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_130px_120px_150px_auto]" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar por nome ou telefone
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Nome ou telefone" />
        <label htmlFor="equipe" className="sr-only">
          Equipe
        </label>
        <Select id="equipe" name="equipe" defaultValue={searchParams.equipe ?? ''}>
          <option value="">Todas as equipes</option>
          {(teams ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
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
          <option value="">Ativas</option>
          <option value="cancelada">Canceladas</option>
          <option value="todas">Todas</option>
        </Select>
        <label htmlFor="pagamento" className="sr-only">
          Pagamento
        </label>
        <Select id="pagamento" name="pagamento" defaultValue={searchParams.pagamento ?? ''}>
          <option value="">Qualquer pagamento</option>
          <option value="a_conferir">A conferir</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
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
          <EmptyState title="Não foi possível carregar os soldados/servos" description="Verifique a conexão e recarregue a página." />
        ) : !rows?.length ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={hasFilters ? 'Nenhum soldado/servo encontrado com esses filtros' : 'Nenhum soldado/servo inscrito ainda'}
            description={hasFilters ? undefined : 'As inscrições pelo link de cada equipe aparecem aqui.'}
            action={hasFilters ? <ButtonLink href="/servidores" variant="secondary" size="sm">Limpar filtros</ButtonLink> : null}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_160px_260px_90px] gap-4 border-b border-pedra-200 px-5 py-2 text-xs text-pedra-500 md:grid">
              <span>Nome</span>
              <span>Telefone</span>
              <span>Equipe · pagamento</span>
              <span>Camiseta</span>
            </div>
            <ul className="divide-y divide-pedra-100">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/servidores/${r.id}`}
                    className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-pedra-100/60 md:grid-cols-[1fr_160px_260px_90px] md:items-center md:gap-4 md:px-5"
                  >
                    <span className="truncate font-bold">
                      {r.full_name}
                      {r.status === 'cancelada' ? (
                        <Badge className="ml-2" tone="neutral">
                          Cancelada
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-right text-sm md:order-last md:text-left">{r.shirt_size ?? <Badge tone="aviso">—</Badge>}</span>
                    <span className="text-sm text-pedra-600">{formatPhone(r.phone)}</span>
                    <span className="truncate text-sm text-pedra-600 max-md:col-span-2">
                      {r.team_name}
                      <Badge className="ml-2" tone={PAYMENT_STATUS[r.payment_status]?.tone}>
                        {PAYMENT_STATUS[r.payment_status]?.label}
                      </Badge>
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
          return `/servidores?${sp.toString()}`;
        }}
      />
    </>
  );
}
