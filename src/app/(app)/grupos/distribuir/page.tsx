import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, EmptyState, Notice, Pagination, Tabs } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ageOn } from '@/lib/format';
import { DistributeForm } from '../DistributeForm';

export const metadata: Metadata = { title: 'Distribuir recrutas' };

const PAGE = 50;

export default async function DistribuirPage({ searchParams }: { searchParams: { ver?: string; q?: string; pagina?: string } }) {
  await requirePerm('grupos.gerenciar');
  const camp = await getActiveCamp();
  if (!camp || !campEditable(camp)) redirect('/grupos');
  const supabase = createClient();
  const all = searchParams.ver === 'todos';
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const q = (searchParams.q ?? '').trim();

  let query = supabase
    .from('encontristas_list')
    .select('id, full_name, birth_date, group_name, shirt_size', { count: 'exact' })
    .eq('camp_id', camp.id)
    .eq('status', 'ativo')
    .order('full_name')
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (!all) query = query.is('group_id', null);
  if (q)
    query = query.ilike(
      'name_normalized',
      `%${q
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[%_]/g, '')}%`,
    );

  const [{ data: rows, count }, { data: groups }] = await Promise.all([
    query,
    supabase.from('participant_groups_overview').select('id, name, capacity, occupied').eq('camp_id', camp.id).order('name'),
  ]);

  const base = '/grupos/distribuir';
  return (
    <>
      <PageHeader
        title="Distribuir recrutas"
        description="Selecione as pessoas e escolha a tropa. Trocar de tropa não cria uma nova ficha."
        back={{ href: '/grupos', label: 'Tropas' }}
      />
      {!groups?.length ? (
        <Notice tone="aviso">
          Crie pelo menos uma tropa antes de distribuir.{' '}
          <Link href="/grupos" className="font-bold underline">
            Ir para tropas
          </Link>
        </Notice>
      ) : (
        <>
          <Tabs
            current={all ? 'todos' : 'sem'}
            items={[
              { key: 'sem', label: 'Sem tropa', href: base },
              { key: 'todos', label: 'Todos (realocar)', href: `${base}?ver=todos` },
            ]}
          />
          <form className="mb-4 flex gap-2" role="search">
            {all ? <input type="hidden" name="ver" value="todos" /> : null}
            <label htmlFor="q" className="sr-only">
              Buscar por nome
            </label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por nome" />
            <button className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-md border border-pedra-300 bg-white text-manto" aria-label="Buscar">
              <Search className="h-5 w-5" />
            </button>
          </form>
          {!rows?.length ? (
            <div className="rounded-lg border border-pedra-200 bg-white">
              <EmptyState
                title={q ? 'Ninguém encontrado' : all ? 'Nenhum recruta ativo' : 'Todos os recrutas já têm tropa'}
                action={!all && !q ? <ButtonLink href={`${base}?ver=todos`} variant="secondary" size="sm">Ver todos para realocar</ButtonLink> : null}
              />
            </div>
          ) : (
            <DistributeForm
              key={`${all}-${page}-${q}`}
              rows={rows.map((r) => ({ id: r.id, full_name: r.full_name, age: ageOn(r.birth_date), group_name: r.group_name, shirt_size: r.shirt_size }))}
              groups={groups}
              allowRemove={all}
            />
          )}
          <Pagination
            page={page}
            pageSize={PAGE}
            total={count ?? 0}
            makeHref={(p) => {
              const sp = new URLSearchParams();
              if (all) sp.set('ver', 'todos');
              if (q) sp.set('q', q);
              sp.set('pagina', String(p));
              return `${base}?${sp.toString()}`;
            }}
          />
        </>
      )}
    </>
  );
}
