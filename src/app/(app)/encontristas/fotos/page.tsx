import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Notice } from '@/components/ui/layout';
import { Input, Select } from '@/components/ui/input';
import { RecrutasTabs } from '@/components/RecrutasTabs';
import { PhotoUploader } from '@/components/PhotoUploader';
import { photoUrl } from '@/lib/photo-url';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Fotos dos recrutas' };
export const dynamic = 'force-dynamic';

type SP = { mostrar?: string; grupo?: string; q?: string };

export default async function FotosPage({ searchParams }: { searchParams: SP }) {
  await requirePerm('encontristas.editar');
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const editable = campEditable(camp);
  const supabase = createClient();
  const [{ data, error }, { data: groups }] = await Promise.all([
    supabase.from('encontristas_list').select('id, full_name, name_normalized, group_id, group_name, photo_path').eq('camp_id', camp.id).eq('status', 'ativo').order('name_normalized').limit(2000),
    supabase.from('participant_groups').select('id, name').eq('camp_id', camp.id).order('name'),
  ]);
  const all = data ?? [];
  const withPhoto = all.filter((r) => r.photo_path).length;
  const show = searchParams.mostrar === 'todos' ? 'todos' : searchParams.mostrar === 'com' ? 'com' : 'sem';
  const q = (searchParams.q ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  const rows = all.filter(
    (r) =>
      (show === 'todos' || (show === 'sem' ? !r.photo_path : Boolean(r.photo_path))) &&
      (!searchParams.grupo || (searchParams.grupo === 'sem' ? !r.group_id : r.group_id === searchParams.grupo)) &&
      (!q || (r.name_normalized ?? '').includes(q)),
  );
  const href = (m: string) => {
    const p = new URLSearchParams({ ...(searchParams.grupo ? { grupo: searchParams.grupo } : {}), ...(searchParams.q ? { q: searchParams.q } : {}), mostrar: m });
    return `/encontristas/fotos?${p}`;
  };
  const pct = all.length ? Math.round((withPhoto / all.length) * 100) : 0;

  return (
    <>
      <PageHeader title="Recrutas" description="Toque no quadrado do recruta para tirar ou escolher a foto. Ela é reduzida no próprio celular e enviada na hora." />
      <RecrutasTabs current="fotos" showFichas showFotos />

      {error ? (
        <Notice tone="erro">{error.code === '42703' ? 'Rode no Supabase o arquivo 0009_fotos_recrutas.sql.' : 'Não foi possível carregar os recrutas.'}</Notice>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-pedra-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-pedra-600">
                <strong className="text-2xl text-pedra-900">{withPhoto}</strong> de {all.length} com foto
              </p>
              <span className="text-sm font-bold text-manto">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
              <div className="h-full rounded-full bg-manto" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Mostrar">
            {[
              ['sem', `Sem foto (${all.length - withPhoto})`],
              ['com', `Com foto (${withPhoto})`],
              ['todos', 'Todos'],
            ].map(([k, label]) => (
              <Link
                key={k}
                href={href(k)}
                aria-current={show === k ? 'true' : undefined}
                className={cn('inline-flex h-9 items-center rounded-full border px-3 text-sm font-bold', show === k ? 'border-manto bg-manto text-white' : 'border-pedra-200 bg-white text-pedra-700 hover:bg-pedra-100')}
              >
                {label}
              </Link>
            ))}
          </div>
          <form className="mb-5 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_220px_auto]" role="search">
            <input type="hidden" name="mostrar" value={show} />
            <label htmlFor="q" className="sr-only">
              Buscar
            </label>
            <Input id="q" name="q" type="search" defaultValue={searchParams.q ?? ''} placeholder="Buscar pelo nome" className="col-span-2 sm:col-span-1" />
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
            <button className="inline-flex h-11 items-center justify-center rounded-md bg-manto px-4 text-sm font-bold text-white">Filtrar</button>
          </form>

          {!rows.length ? (
            <div className="rounded-xl border border-dashed border-pedra-300 bg-white px-6 py-12 text-center">
              <Camera className="mx-auto h-8 w-8 text-pedra-300" aria-hidden />
              <p className="mt-3 font-bold">{show === 'sem' && all.length ? 'Todos os recrutas desta lista já têm foto' : 'Nenhum recruta nesta lista'}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-pedra-200 bg-white p-2">
                  <PhotoUploader id={r.id} name={r.full_name} url={photoUrl(r.id, r.photo_path)} canEdit={editable} variant="tile" />
                  <Link href={`/encontristas/${r.id}`} className="mt-2 block px-1 pb-1">
                    <span className="block truncate text-sm font-bold hover:underline">{r.full_name}</span>
                    <span className="block truncate text-xs text-pedra-500">{r.group_name ?? 'Sem tropa'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
