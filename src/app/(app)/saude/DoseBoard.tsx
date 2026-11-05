"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Info, Loader2, Pill, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { RecrutaAvatar } from "@/components/RecrutaAvatar";
import { TIME_ZONE } from "@/config/app";
import { markDose } from "./actions";

export type DoseRow = {
  plan_id: string;
  encontrista_id: string;
  full_name: string;
  group_name: string | null;
  medication: string;
  dose: string | null;
  instructions: string | null;
  dose_time: string;
  status: "pendente" | "dado" | "nao_dado";
  note: string | null;
  marked_at: string | null;
  marked_by_name: string | null;
  photo_path?: string | null;
};

const key = (r: DoseRow) => `${r.plan_id}|${r.dose_time}`;
const hhmm = (t: string) => t.slice(0, 5);
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
function nowHHMM() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function DoseBoard({
  rows: initial,
  date,
  isToday,
  canMark,
  canOpenSheet,
}: {
  rows: DoseRow[];
  date: string;
  isToday: boolean;
  canMark: boolean;
  canOpenSheet: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<string | null>(null);
  React.useEffect(() => setRows(initial), [initial]);
  React.useEffect(() => {
    setNow(nowHHMM());
    const t = setInterval(() => {
      setNow(nowHHMM());
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => clearInterval(t);
  }, [router]);

  async function mark(r: DoseRow, status: DoseRow["status"]) {
    const k = key(r);
    setBusy(k);
    const res = await markDose(r.plan_id, date, hhmm(r.dose_time), status);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows((list) =>
      list.map((x) =>
        key(x) === k
          ? {
              ...x,
              status,
              marked_at: status === "pendente" ? null : res.at,
              marked_by_name: status === "pendente" ? null : "você",
            }
          : x,
      ),
    );
    toast.success(
      status === "dado"
        ? `${r.medication} dado para ${r.full_name.split(" ")[0]}`
        : status === "nao_dado"
          ? "Marcado como não dado"
          : "Marcação desfeita",
    );
    router.refresh();
  }

  const total = rows.length;
  const given = rows.filter((r) => r.status === "dado").length;
  const late =
    isToday && now
      ? rows.filter((r) => r.status === "pendente" && hhmm(r.dose_time) < now)
          .length
      : 0;
  const groups = new Map<string, DoseRow[]>();
  for (const r of rows)
    groups.set(hhmm(r.dose_time), [
      ...(groups.get(hhmm(r.dose_time)) ?? []),
      r,
    ]);
  const nextSlot =
    isToday && now
      ? Array.from(groups.entries()).find(
          ([t, list]) => t >= now || list.some((r) => r.status === "pendente"),
        )?.[0]
      : undefined;

  if (!total) {
    return (
      <div className="rounded-xl border border-dashed border-pedra-300 bg-white px-6 py-12 text-center">
        <Pill className="mx-auto h-8 w-8 text-pedra-300" aria-hidden />
        <p className="mt-3 font-bold">Nenhum remédio para este dia</p>
        <p className="mt-1 text-sm text-pedra-500">
          Os remédios cadastrados aparecem aqui em ordem de horário.
        </p>
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
        <div
          className={cn(
            "rounded-xl border p-4",
            late ? "border-erro/30 bg-erro-50" : "border-pedra-200 bg-white",
          )}
        >
          <p className={cn("text-xs", late ? "text-erro" : "text-pedra-500")}>
            Atrasadas
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              late ? "text-erro" : "text-pedra-900",
            )}
          >
            {isToday ? late : "—"}
          </p>
        </div>
      </div>

      {Array.from(groups.entries()).map(([slot, list]) => {
        const pending = list.filter((r) => r.status === 'pendente').length;
        const isLate = isToday && now !== null && slot < now && pending > 0;
        const isNext = slot === nextSlot;
        const label = isLate ? 'Atrasado' : pending === 0 ? 'Tudo dado' : isNext ? 'Próximo horário' : `${pending} dose(s) a dar`;
        return (
          <section key={slot} aria-label={`Horário ${slot}`}>
            <header className="mb-3 flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-2xl font-bold leading-none shadow-sm sm:text-3xl',
                  isLate ? 'bg-erro text-white' : pending === 0 ? 'bg-pedra-100 text-pedra-400' : isNext ? 'bg-cirio text-manto-800' : 'bg-manto text-white',
                )}
              >
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                {slot}
              </span>
              <span className={cn('text-xs font-bold uppercase tracking-[0.14em]', isLate ? 'text-erro' : pending === 0 ? 'text-ok' : isNext ? 'text-cirio-700' : 'text-pedra-500')}>
                {label}
              </span>
              <span aria-hidden className="h-px flex-1 bg-pedra-200" />
            </header>
            <ul className="space-y-3">
              {list.map((r) => {
                const k = key(r);
                const done = r.status !== 'pendente';
                const late = isLate && !done;
                return (
                  <li
                    key={k}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border bg-white pl-1.5 transition',
                      late
                        ? 'border-erro/40 shadow-[0_12px_32px_-16px_rgba(180,35,24,0.55)]'
                        : done
                          ? 'border-pedra-200 opacity-80'
                          : isNext
                            ? 'border-cirio shadow-[0_12px_32px_-16px_rgba(200,161,101,0.8)]'
                            : 'border-pedra-200 shadow-[0_10px_28px_-20px_rgba(21,32,46,0.5)]',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-0 left-0 w-1.5',
                        late ? 'bg-erro' : r.status === 'dado' ? 'bg-ok' : r.status === 'nao_dado' ? 'bg-pedra-300' : isNext ? 'bg-cirio' : 'bg-manto',
                      )}
                    />
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <RecrutaAvatar id={r.encontrista_id} name={r.full_name} path={r.photo_path} size="lg" className="rounded-2xl sm:h-24 sm:w-24" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {canOpenSheet ? (
                              <Link href={`/encontristas/${r.encontrista_id}`} className={cn('text-lg font-bold leading-tight hover:underline', done && 'text-pedra-500')}>
                                {r.full_name}
                              </Link>
                            ) : (
                              <span className={cn('text-lg font-bold leading-tight', done && 'text-pedra-500')}>{r.full_name}</span>
                            )}
                            <span className="rounded-md bg-pedra-100 px-2 py-0.5 text-xs font-bold text-pedra-600">{r.group_name ?? 'Sem tropa'}</span>
                          </div>
                          <div className={cn('mt-2.5 flex items-center gap-3 rounded-xl px-3 py-2.5', done ? 'bg-pedra-100' : 'bg-manto-50 ring-1 ring-manto/10')}>
                            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', done ? 'bg-white text-pedra-400' : 'bg-manto text-white')}>
                              <Pill className="h-5 w-5" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className={cn('block text-lg font-bold leading-tight sm:text-xl', done ? 'text-pedra-500' : 'text-manto-800')}>{r.medication}</span>
                              {r.dose ? <span className="block text-sm text-pedra-600">{r.dose}</span> : null}
                            </span>
                          </div>
                          {r.instructions ? (
                            <p className="mt-2 flex items-start gap-1.5 text-sm text-pedra-700">
                              <Info className="mt-0.5 h-4 w-4 shrink-0 text-cirio-700" aria-hidden />
                              {r.instructions}
                            </p>
                          ) : null}
                          {done ? (
                            <p className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', r.status === 'dado' ? 'bg-ok-50 text-ok' : 'bg-erro-50 text-erro')}>
                              {r.status === 'dado' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" />}
                              {r.status === 'dado' ? 'Dado' : 'Não dado'}
                              {r.marked_at ? ` às ${timeOf(r.marked_at)}` : ''}
                              {r.marked_by_name ? ` por ${r.marked_by_name}` : ''}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {canMark ? (
                        done ? (
                          <button
                            type="button"
                            onClick={() => mark(r, 'pendente')}
                            disabled={busy === k}
                            className="inline-flex h-11 items-center justify-center gap-1.5 self-end rounded-lg border border-pedra-200 bg-white px-4 text-sm font-bold text-pedra-600 hover:bg-pedra-100 sm:self-center"
                          >
                            {busy === k ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Desfazer
                          </button>
                        ) : (
                          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-col">
                            <button
                              type="button"
                              onClick={() => mark(r, 'dado')}
                              disabled={busy === k}
                              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-ok px-7 text-lg font-bold text-white shadow-sm hover:bg-ok/90 disabled:opacity-60 sm:min-w-[170px]"
                            >
                              {busy === k ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" strokeWidth={3} />} Dado
                            </button>
                            <button
                              type="button"
                              onClick={() => mark(r, 'nao_dado')}
                              disabled={busy === k}
                              className="inline-flex h-14 items-center justify-center gap-1.5 rounded-xl border border-pedra-300 bg-white px-4 text-sm font-bold text-pedra-700 hover:bg-pedra-100 disabled:opacity-60 sm:h-10"
                            >
                              <X className="h-4 w-4" /> Não dado
                            </button>
                          </div>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {isToday ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-pedra-500">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Atualiza sozinho a cada
          20 segundos.
        </p>
      ) : null}
    </div>
  );
}
