import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Notice, EmptyState, Badge } from '@/components/ui/layout';
import { buttonClass } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { formatDateTime } from '@/lib/format';
import { NO_SIZE, countBy, sizeOrder, type ShirtRow } from '@/lib/shirts';
import { cn } from '@/lib/cn';
import { CloseOrderForm } from './CloseOrderForm';

export const metadata: Metadata = { title: 'Camisetas' };
export const dynamic = 'force-dynamic';

type SP = { tipo?: string; onde?: string; tamanho?: string };
type Order = { id: string; version: number; totals: Record<string, number>; note: string | null; created_at: string; creator: { full_name: string } | null };

function qs(sp: SP) {
  const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  return p.toString() ? `?${p}` : '';
}

export default async function CamisetasPage({ searchParams }: { searchParams: SP }) {
  await requirePerm('camisetas.ver');
  const camp = await getActiveCamp();
  const supabase = createClient();
  const [{ data, error }, { data: orders }] = await Promise.all([
    supabase.rpc('shirt_list'),
    supabase.from('shirt_orders').select('id, version, totals, note, created_at, creator:profiles!shirt_orders_created_by_fkey(full_name)').order('version', { ascending: false }),
  ]);
  if (error) {
    return (
      <>
        <PageHeader title="Camisetas" />
        <Notice tone="erro">{error.code === 'PGRST202' ? 'Rode no Supabase o arquivo 0006_presenca_camisetas.sql.' : 'Não foi possível carregar as camisetas.'}</Notice>
      </>
    );
  }
  const all = ((data ?? []) as { kind: string; person: string; shirt_size: string | null; team_or_group: string }[]).map(
    (r): ShirtRow => ({ kind: r.kind, person: r.person, size: r.shirt_size, where: r.team_or_group }),
  );
  const places = Array.from(new Set(all.map((r) => `${r.kind}|${r.where}`))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const rows = all.filter(
    (r) =>
      (!searchParams.tipo || r.kind === searchParams.tipo) &&
      (!searchParams.onde || `${r.kind}|${r.where}` === searchParams.onde) &&
      (!searchParams.tamanho || (r.size || NO_SIZE) === searchParams.tamanho),
  );
  const { bySize, byWhere } = countBy(rows);
  const sizes = sizeOrder(camp?.shirt_sizes ?? [], Object.keys(countBy(all).bySize));
  const shownSizes = sizes.filter((s) => bySize[s]);
  const last = (orders ?? [])[0] as unknown as Order | undefined;
  const allTotals = countBy(all).bySize;
  const changed = last ? sizes.some((s) => (last.totals[s] ?? 0) !== (allTotals[s] ?? 0)) : false;
  const filtered = Boolean(searchParams.tipo || searchParams.onde || searchParams.tamanho);

  return (
    <>
      <PageHeader
        title="Camisetas"
        description="Totais a partir das inscrições ativas de soldados/servos e das fichas ativas de recrutas. Cancelados não entram."
        actions={
          <a href={`/camisetas/exportar${qs(searchParams)}`} className={buttonClass('secondary')}>
            <Download className="h-4 w-4" /> Exportar Excel
          </a>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[190px_1fr_190px_auto]">
        <label htmlFor="tipo" className="sr-only">
          Tipo
        </label>
        <Select id="tipo" name="tipo" defaultValue={searchParams.tipo ?? ''}>
          <option value="">Servos e recrutas</option>
          <option value="Soldado/servo">Só soldados/servos</option>
          <option value="Recruta">Só recrutas</option>
        </Select>
        <label htmlFor="onde" className="sr-only">
          Equipe ou tropa
        </label>
        <Select id="onde" name="onde" defaultValue={searchParams.onde ?? ''}>
          <option value="">Todas as equipes e tropas</option>
          {places.map((p) => {
            const [kind, where] = p.split('|');
            return (
              <option key={p} value={p}>
                {kind === 'Recruta' ? 'Tropa' : 'Equipe'} · {where}
              </option>
            );
          })}
        </Select>
        <label htmlFor="tamanho" className="sr-only">
          Tamanho
        </label>
        <Select id="tamanho" name="tamanho" defaultValue={searchParams.tamanho ?? ''}>
          <option value="">Todos os tamanhos</option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <button className="inline-flex h-11 items-center justify-center rounded-md bg-manto px-4 text-sm font-bold text-white">Filtrar</button>
      </form>

      {!rows.length ? (
        <div className="rounded-lg border border-pedra-200 bg-white">
          <EmptyState title={filtered ? 'Nenhuma camiseta com esses filtros' : 'Nenhuma inscrição ainda'} />
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-label="Total por tamanho" className="rounded-lg border border-pedra-200 bg-white p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base">{filtered ? 'Total com os filtros' : 'Total geral para o fornecedor'}</h2>
              <p className="text-sm text-pedra-600">
                <strong className="text-2xl text-pedra-900">{rows.length}</strong> camiseta(s)
              </p>
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {shownSizes.map((s) => (
                <li key={s} className={cn('rounded-lg border p-3 text-center', s === NO_SIZE ? 'border-aviso/40 bg-aviso-50' : 'border-pedra-200 bg-pedra')}>
                  <p className={cn('text-xs font-bold', s === NO_SIZE ? 'text-aviso' : 'text-pedra-500')}>{s}</p>
                  <p className="mt-0.5 text-2xl font-bold text-pedra-900">{bySize[s]}</p>
                </li>
              ))}
            </ul>
            {bySize[NO_SIZE] ? (
              <p className="mt-3 text-xs text-aviso">Há pessoas sem tamanho informado. Complete na ficha antes de fechar o pedido.</p>
            ) : null}
          </section>

          <Panel title="Por equipe e por tropa" bodyClassName="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-pedra-200 text-left text-xs text-pedra-500">
                    <th className="px-4 py-2 font-normal sm:px-5">Equipe / tropa</th>
                    {shownSizes.map((s) => (
                      <th key={s} className="px-2 py-2 text-center font-normal">
                        {s}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right font-normal sm:px-5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pedra-100">
                  {Object.entries(byWhere)
                    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
                    .map(([key, v]) => (
                      <tr key={key}>
                        <td className="px-4 py-2 sm:px-5">
                          <span className="font-bold">{key.split('|')[1]}</span>{' '}
                          <span className="text-xs text-pedra-500">{v.kind === 'Recruta' ? 'tropa' : 'equipe'}</span>
                        </td>
                        {shownSizes.map((s) => (
                          <td key={s} className="px-2 py-2 text-center">
                            {v.sizes[s] ?? <span className="text-pedra-300">·</span>}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold sm:px-5">{v.total}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Panel title="Lista nominal para conferência" bodyClassName="p-0 sm:p-0">
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-manto sm:px-5">Mostrar as {rows.length} pessoas</summary>
                <ul className="divide-y divide-pedra-100 border-t border-pedra-100">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{r.person}</span>
                        <span className="text-xs text-pedra-500">
                          {r.kind} · {r.where}
                        </span>
                      </span>
                      <Badge tone={r.size ? 'neutral' : 'aviso'}>{r.size ?? 'Sem tamanho'}</Badge>
                    </li>
                  ))}
                </ul>
              </details>
            </Panel>

            <div className="space-y-5">
              <Panel title="Fechar pedido" description="Guarda os totais de agora como uma versão. Se algo mudar depois, feche de novo: as versões anteriores ficam guardadas.">
                {last && changed ? (
                  <Notice tone="aviso" className="mb-3">
                    Os totais mudaram desde a versão {last.version}.
                  </Notice>
                ) : null}
                <CloseOrderForm />
              </Panel>
              {orders?.length ? (
                <Panel title="Pedidos fechados" bodyClassName="p-0 sm:p-0">
                  <ul className="divide-y divide-pedra-100">
                    {(orders as unknown as Order[]).map((o) => (
                      <li key={o.id} className="px-4 py-3 text-sm sm:px-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold">Versão {o.version}</span>
                          <Link href={`/camisetas/exportar?versao=${o.version}`} prefetch={false} className="inline-flex items-center gap-1 text-xs font-bold text-manto hover:underline">
                            <Download className="h-3.5 w-3.5" /> Excel
                          </Link>
                        </div>
                        <p className="text-xs text-pedra-500">
                          {formatDateTime(o.created_at)} · {o.creator?.full_name ?? '—'}
                        </p>
                        <p className="mt-1 text-xs text-pedra-700">
                          {sizes
                            .filter((s) => o.totals[s])
                            .map((s) => `${s}: ${o.totals[s]}`)
                            .join(' · ')}
                        </p>
                        {o.note ? <p className="mt-1 text-xs italic text-pedra-500">{o.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
