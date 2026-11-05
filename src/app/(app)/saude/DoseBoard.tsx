'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Clock, Loader2, Pill, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { TIME_ZONE } from '@/config/app';
import { markDose } from './actions';

export type DoseRow = {
  plan_id: string;
  encontrista_id: string;
  full_name: string;
  group_name: string | null;
  medication: string;
  dose: string | null;
  instructions: string | null;
  dose_time: string;
  status: 'pendente' | 'dado' | 'nao_dado';
  note: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
};

const key = (r: DoseRow) => `${r.plan_id}|${r.dose_time}`;
const hhmm = (t: string) => t.slice(0, 5);
const timeOf = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
function nowHHMM() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export function DoseBoard({ rows: initial, date, isToday, canMark, canOpenSheet }: { rows: DoseRow[]; date: string; isToday: boolean; canMark: boolean; canOpenSheet: boolean }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<string | null>(null);
  React.useEffect(() => setRows(initial), [initial]);
  React.useEffect(() => {
    setNow(nowHHMM());
    const t = setInterval(() => {
      setNow(nowHHMM());
      if (document.visibilityState === 'visible') router.refresh();
    }, 20000);
    return () => clearInterval(t);
  }, [router]);

  async function mark(r: DoseRow, status: DoseRow['status']) {
    const k = key(r);
    setBusy(k);
    const res = await markDose(r.plan_id, date, hhmm(r.dose_time), status);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows((list) =>
      list.map((x) => (key(x) === k ? { ...x, status, marked_at: status === 'pendente' ? null : res.at, marked_by_name: status === 'pendente' ? null : 'você' } : x)),
    );
    toast.success(status === 'dado' ? `${r.medication} dado para ${r.full_name.split(' ')[0]}` : status === 'nao_dado' ? 'Marcado como não dado' : 'Marcação desfeita');
    router.refresh();
  }

  const total = rows.length;
  const given = rows.filter((r) => r.status === 'dado').length;
  const late = isToday && now ? rows.filter((r) => r.status === 'pendente' && hhmm(r.dose_time) < now).length : 0;
  const groups = new Map<string, DoseRow[]>();
  for (const r of rows) groups.set(hhmm(r.dose_time), [...(groups.get(hhmm(r.dose_time)) ?? []), r]);
  const nextSlot = isToday && now ? Array.from(groups.entries()).find(([t, list]) => t >= now || list.some((r) => r.status === 'pendente'))?.[0] : undefined;

  if (!total) {
    return (
      <div className="rounded-xl border border-dashed border-pedra-300 bg-white px-6 py-12 text-center">
        <Pill className="mx-auto h-8 w-8 text-pedra-300" aria-hidden />
        <p className="mt-3 font-bold">Nenhum remédio para este dia</p>
        <p className="mt-1 text-sm text-pedra-500">Os remédios cadastrados aparecem aqui em ordem de horário.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-pedra-200 bg-white p-4">
          <p className="text-xs text-pedra-500">Doses no dia</p>
          <p className="mt-1 text-2xl font-bold">{total}</p>
        </div>
        <div className="rounded-xl border border-ok/30 bg-ok-50 p-4">
          <p className="text-xs text-ok">Dadas</p>
          <p className="mt-1 text-2xl font-bold text-ok">
            {given}
            <span className="text-sm font-normal text-ok/70"> de {total}</span>
          </p>
        </div>
        <div className={cn('rounded-xl border p-4', late ? 'border-erro/30 bg-erro-50' : 'border-pedra-200 bg-white')}>
          <p className={cn('text-xs', late ? 'text-erro' : 'text-pedra-500')}>Atrasadas</p>
          <p className={cn('mt-1 text-2xl font-bold', late ? 'text-erro' : 'text-pedra-900')}>{isToday ? late : '—'}</p>
        </div>
      </div>

      {Array.from(groups.entries()).map(([slot, list]) => {
        const pending = list.filter((r) => r.status === 'pendente').length;
        const isLate = isToday && now !== null && slot < now && pending > 0;
        const isNext = slot === nextSlot;
        return (
          <section key={slot} aria-label={`Horário ${slot}`} className="grid grid-cols-[64px_1fr] gap-3 sm:grid-cols-[84px_1fr] sm:gap-5">
            <div className="pt-3 text-right">
              <p className={cn('text-xl font-bold leading-none sm:text-2xl', isLate ? 'text-erro' : pending ? 'text-pedra-900' : 'text-pedra-400')}>{slot}</p>
              <p className={cn('mt-1 text-[11px] font-bold uppercase tracking-wider', isLate ? 'text-erro' : isNext ? 'text-cirio-700' : 'text-pedra-400')}>
                {isLate ? 'Atrasado' : pending === 0 ? 'Feito' : isNext ? 'Próximo' : `${pending} a dar`}
              </p>
            </div>
            <ul
              className={cn(
                'divide-y divide-pedra-100 overflow-hidden rounded-xl border bg-white',
                isLate ? 'border-erro/40 ring-1 ring-erro/20' : isNext ? 'border-cirio ring-1 ring-cirio/40 shadow-[0_10px_30px_-14px_rgba(200,161,101,0.7)]' : 'border-pedra-200',
              )}
            >
              {list.map((r) => {
                const k = key(r);
                const done = r.status !== 'pendente';
                return (
                  <li key={k} className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', done && 'bg-pedra/60')}>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {canOpenSheet ? (
                          <Link href={`/encontristas/${r.encontrista_id}`} className={cn('font-bold hover:underline', done && 'text-pedra-500')}>
                            {r.full_name}
                          </Link>
                        ) : (
                          <span className={cn('font-bold', done && 'text-pedra-500')}>{r.full_name}</span>
                        )}
                        <span className="text-xs text-pedra-500">{r.group_name ?? 'Sem tropa'}</span>
                      </p>
                      <p className={cn('mt-1 inline-flex items-center gap-1.5 text-sm font-bold', done ? 'text-pedra-500' : 'text-manto')}>
                        <Pill className="h-4 w-4 shrink-0" aria-hidden />
                        {r.medication}
                        {r.dose ? <span className="font-normal text-pedra-600">· {r.dose}</span> : null}
                      </p>
                      {r.instructions ? <p className="mt-0.5 text-xs text-pedra-600">{r.instructions}</p> : null}
                      {done ? (
                        <p className={cn('mt-1 text-xs font-bold', r.status === 'dado' ? 'text-ok' : 'text-erro')}>
                          {r.status === 'dado' ? 'Dado' : 'Não dado'}
                          {r.marked_at ? ` às ${timeOf(r.marked_at)}` : ''}
                          {r.marked_by_name ? ` por ${r.marked_by_name}` : ''}
                        </p>
                      ) : null}
                    </div>
                    {canMark ? (
                      done ? (
                        <button
                          type="button"
                          onClick={() => mark(r, 'pendente')}
                          disabled={busy === k}
                          className="inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-md px-3 text-sm font-bold text-pedra-600 hover:bg-pedra-100 sm:self-center"
                        >
                          {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Desfazer
                        </button>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
                          <button
                            type="button"
                            onClick={() => mark(r, 'dado')}
                            disabled={busy === k}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ok px-5 text-base font-bold text-white hover:bg-ok/90 disabled:opacity-60"
                          >
                            {busy === k ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={3} />} Dado
                          </button>
                          <button
                            type="button"
                            onClick={() => mark(r, 'nao_dado')}
                            disabled={busy === k}
                            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border border-pedra-300 bg-white px-4 text-sm font-bold text-pedra-700 hover:bg-pedra-100 disabled:opacity-60"
                          >
                            <X className="h-4 w-4" /> Não dado
                          </button>
                        </div>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {isToday ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-pedra-500">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Atualiza sozinho a cada 20 segundos.
        </p>
      ) : null}
    </div>
  );
}
