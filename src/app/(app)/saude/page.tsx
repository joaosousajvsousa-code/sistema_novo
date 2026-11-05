import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pencil, Pill, Plus } from 'lucide-react';
import { can, requireCheck } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Notice, Badge } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { todayISO, formatDate } from '@/lib/format';
import { canManageMeds, canViewMeds, hhmm } from '@/lib/meds';
import { cn } from '@/lib/cn';
import { DoseBoard, type DoseRow } from './DoseBoard';
import { PlanActiveForm } from './PlanForm';

export const metadata: Metadata = { title: 'Saúde' };
export const dynamic = 'force-dynamic';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayLabel(iso: string, short = false) {
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: short ? 'short' : 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
}

type Plan = {
  id: string;
  medication: string;
  dose: string | null;
  times: string[];
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
  active: boolean;
  encontrista: { id: string; status: string; person: { full_name: string } | null } | null;
};

export default async function SaudePage({ searchParams }: { searchParams: { dia?: string; salvo?: string } }) {
  const access = await requireCheck(canViewMeds);
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const manage = canManageMeds(access) && campEditable(camp);
  const canMark = campEditable(camp);
  const today = todayISO();

  // Dias do acampamento (se as datas estiverem definidas).
  const campDays: string[] = [];
  if (camp.start_date && camp.end_date && camp.end_date >= camp.start_date) {
    for (let d = camp.start_date; d <= camp.end_date && campDays.length < 15; d = addDays(d, 1)) campDays.push(d);
  }
  const fallback = campDays.length && !campDays.includes(today) && today < campDays[0] ? campDays[0] : today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.dia ?? '') ? searchParams.dia! : fallback;

  const supabase = createClient();
  const [{ data: rows, error }, { data: plans }] = await Promise.all([
    supabase.rpc('medication_schedule', { p_date: date }),
    supabase
      .from('medication_plans')
      .select('id, medication, dose, times, start_date, end_date, instructions, active, encontrista:encontristas(id, status, person:people(full_name))')
      .eq('camp_id', camp.id)
      .order('created_at'),
  ]);

  // Fotos dos recrutas do dia (lidas depois de conferir a permissão acima).
  const doseRows = (rows ?? []) as DoseRow[];
  const ids = Array.from(new Set(doseRows.map((r) => r.encontrista_id)));
  const photos: Record<string, string | null> = {};
  if (ids.length) {
    const { data: ph } = await createAdminClient().from('encontristas').select('id, photo_path').in('id', ids);
    for (const p of ph ?? []) photos[p.id] = p.photo_path;
  }
  const rowsWithPhoto = doseRows.map((r) => ({ ...r, photo_path: photos[r.encontrista_id] ?? null }));

  const list = ((plans ?? []) as unknown as Plan[]).filter((p) => p.encontrista?.status === 'ativo');
  list.sort((a, b) => (a.encontrista?.person?.full_name ?? '').localeCompare(b.encontrista?.person?.full_name ?? '', 'pt-BR'));

  return (
    <>
      <PageHeader
        title="Saúde"
        description="Remédios dos recrutas em ordem de horário. Marque cada dose quando for dada."
        actions={
          manage ? (
            <ButtonLink href="/saude/novo">
              <Plus className="h-4 w-4" /> Adicionar remédio
            </ButtonLink>
          ) : null
        }
      />
      {searchParams.salvo ? (
        <Notice tone="ok" className="mb-5">
          Remédio salvo.
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="erro">{error.code === 'PGRST202' ? 'Rode no Supabase o arquivo 0007_saude_medicacao.sql.' : 'Não foi possível carregar os remédios.'}</Notice>
      ) : (
        <>
          <nav aria-label="Dia" className="mb-5 flex items-center gap-2">
            <Link href={`/saude?dia=${addDays(date, -1)}`} aria-label="Dia anterior" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-pedra-200 bg-white hover:bg-pedra-100">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            {campDays.length ? (
              <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                {campDays.map((d) => (
                  <li key={d}>
                    <Link
                      href={`/saude?dia=${d}`}
                      aria-current={d === date ? 'date' : undefined}
                      className={cn(
                        'flex h-11 items-center whitespace-nowrap rounded-lg border px-3 text-sm font-bold',
                        d === date ? 'border-manto bg-manto text-white' : 'border-pedra-200 bg-white text-pedra-700 hover:bg-pedra-100',
                      )}
                    >
                      {dayLabel(d, true)}
                      {d === today ? <span className={cn('ml-1.5 text-[10px] uppercase', d === date ? 'text-cirio' : 'text-cirio-700')}>hoje</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex h-11 flex-1 items-center justify-center rounded-lg border border-pedra-200 bg-white text-sm font-bold">
                {dayLabel(date)}
                {date === today ? <span className="ml-1.5 text-[10px] uppercase text-cirio-700">hoje</span> : null}
              </p>
            )}
            <Link href={`/saude?dia=${addDays(date, 1)}`} aria-label="Próximo dia" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-pedra-200 bg-white hover:bg-pedra-100">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </nav>
          {campDays.length && !campDays.includes(date) ? <p className="-mt-3 mb-5 text-center text-xs text-pedra-500">{dayLabel(date)} (fora das datas do acampamento)</p> : null}

          <DoseBoard rows={rowsWithPhoto} date={date} isToday={date === today} canMark={canMark} canOpenSheet={can(access, 'encontristas.ver')} />

          <section aria-labelledby="remedios" className="mt-10">
            <header className="mb-3 flex items-center gap-3">
              <h2 id="remedios" className="text-xs font-bold uppercase tracking-[0.14em] text-manto">
                Remédios cadastrados
              </h2>
              <span aria-hidden className="h-px flex-1 bg-pedra-200" />
              <span className="text-xs text-pedra-500">{list.filter((p) => p.active).length} ativo(s)</span>
            </header>
            {!list.length ? (
              <p className="rounded-xl border border-pedra-200 bg-white px-5 py-6 text-sm text-pedra-500">
                Nenhum remédio cadastrado.{manage ? ' Use “Adicionar remédio” para montar o cronograma.' : ''}
              </p>
            ) : (
              <ul className="divide-y divide-pedra-100 overflow-hidden rounded-xl border border-pedra-200 bg-white">
                {list.map((p) => (
                  <li key={p.id} className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5', !p.active && 'opacity-60')}>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{p.encontrista?.person?.full_name}</span>
                        {!p.active ? <Badge tone="neutral">Suspenso</Badge> : null}
                      </p>
                      <p className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-sm text-manto">
                        <Pill className="h-4 w-4" aria-hidden />
                        <span className="font-bold">{p.medication}</span>
                        {p.dose ? <span className="text-pedra-600">· {p.dose}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-pedra-500">
                        {p.times.map(hhmm).join(' · ')}
                        {p.start_date || p.end_date
                          ? ` — ${p.start_date ? `de ${formatDate(p.start_date)}` : ''}${p.start_date && p.end_date ? ' ' : ''}${p.end_date ? `até ${formatDate(p.end_date)}` : ''}`
                          : ' — todos os dias'}
                      </p>
                    </div>
                    {manage ? (
                      <div className="flex items-center gap-1">
                        <Link href={`/saude/${p.id}/editar`} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold text-manto hover:bg-manto-50">
                          <Pencil className="h-4 w-4" /> Editar
                        </Link>
                        <PlanActiveForm id={p.id} active={p.active} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
