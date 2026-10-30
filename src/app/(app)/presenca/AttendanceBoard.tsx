'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Search, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import { markAttendance } from './actions';

export type Row = {
  id: string;
  full_name: string;
  phone: string | null;
  group_id: string | null;
  group_name: string | null;
  shirt_size: string | null;
  attendance_status: 'pendente' | 'presente' | 'ausente';
  attendance_at: string | null;
  attendance_by_name: string | null;
};

const NO_GROUP = 'sem';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function time(v: string | null) {
  if (!v) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}

export function AttendanceBoard({ initial, canMark, canOpenSheet }: { initial: Row[]; canMark: boolean; canOpenSheet: boolean }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<'todos' | Row['attendance_status']>('todos');
  const [group, setGroup] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => setRows(initial), [initial]);
  // Mantém em dia com o que os outros marcam.
  React.useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && router.refresh(), 20000);
    return () => window.clearInterval(t);
  }, [router]);

  const groups = React.useMemo(() => {
    const m = new Map<string, { name: string; total: number; presente: number; ausente: number }>();
    for (const r of rows) {
      const k = r.group_id ?? NO_GROUP;
      const g = m.get(k) ?? { name: r.group_name ?? 'Sem tropa', total: 0, presente: 0, ausente: 0 };
      g.total++;
      if (r.attendance_status === 'presente') g.presente++;
      if (r.attendance_status === 'ausente') g.ausente++;
      m.set(k, g);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'));
  }, [rows]);

  const total = rows.length;
  const presentes = rows.filter((r) => r.attendance_status === 'presente').length;
  const ausentes = rows.filter((r) => r.attendance_status === 'ausente').length;

  const qn = norm(q);
  const qd = q.replace(/\D/g, '');
  const visible = rows.filter(
    (r) =>
      (status === 'todos' || r.attendance_status === status) &&
      (!group || (r.group_id ?? NO_GROUP) === group) &&
      (!qn || norm(r.full_name).includes(qn) || (qd.length >= 4 && (r.phone ?? '').replace(/\D/g, '').includes(qd))),
  );

  async function mark(r: Row, next: Row['attendance_status']) {
    setBusy(r.id);
    const res = await markAttendance(r.id, next);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error ?? 'Não foi possível salvar.');
      return;
    }
    setRows((list) => list.map((x) => (x.id === r.id ? { ...x, attendance_status: next, attendance_at: next === 'pendente' ? null : res.at ?? null, attendance_by_name: next === 'pendente' ? null : 'você' } : x)));
    toast.success(next === 'presente' ? `${r.full_name.split(' ')[0]} presente` : next === 'ausente' ? `${r.full_name.split(' ')[0]} ausente` : 'Marcação desfeita');
    if (next !== 'pendente' && q) setQ('');
    router.refresh();
  }

  const pct = total ? Math.round((presentes / total) * 100) : 0;

  return (
    <div>
      <section aria-label="Contagem" className="mb-4 rounded-lg border border-pedra-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-pedra-600">
            <span className="text-3xl font-bold text-ok">{presentes}</span> de {total} presentes
          </p>
          <p className="text-sm text-pedra-600">
            {ausentes} ausente(s) · {total - presentes - ausentes} pendente(s)
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
          <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
        </div>
        {groups.length > 1 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-bold text-manto">Ver por tropa</summary>
            <ul className="mt-2 divide-y divide-pedra-100 text-sm">
              {groups.map(([id, g]) => (
                <li key={id} className="flex justify-between gap-3 py-1.5">
                  <span>{g.name}</span>
                  <span className="text-pedra-600">
                    <strong className="text-ok">{g.presente}</strong>/{g.total}
                    {g.ausente ? <span className="text-erro"> · {g.ausente} ausente(s)</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="sticky top-14 z-[5] -mx-4 mb-3 space-y-2 bg-pedra/95 px-4 py-2 backdrop-blur sm:top-16 sm:mx-0 sm:px-0">
        <label className="relative block">
          <span className="sr-only">Buscar recruta por nome ou telefone</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-pedra-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Buscar por nome ou telefone"
            className="h-12 w-full rounded-lg border border-pedra-300 bg-white pl-11 pr-3 text-base focus:border-manto focus:outline-none focus:ring-2 focus:ring-manto/20"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['todos', 'pendente', 'presente', 'ausente'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={cn(
                'h-9 shrink-0 rounded-full border px-4 text-sm font-bold',
                status === s ? 'border-manto bg-manto text-white' : 'border-pedra-300 bg-white text-pedra-700',
              )}
            >
              {s === 'todos' ? 'Todos' : s === 'pendente' ? 'Pendentes' : s === 'presente' ? 'Presentes' : 'Ausentes'}
            </button>
          ))}
          {groups.length > 1 ? (
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label="Tropa"
              className="h-9 shrink-0 rounded-full border border-pedra-300 bg-white px-3 text-sm font-bold text-pedra-700"
            >
              <option value="">Todas as tropas</option>
              {groups.map(([id, g]) => (
                <option key={id} value={id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-pedra-200 bg-white px-4 py-10 text-center text-sm text-pedra-500">
          {q ? 'Ninguém encontrado com essa busca.' : 'Nenhum recruta nesta lista.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const pending = busy === r.id;
            return (
              <li
                key={r.id}
                className={cn(
                  'rounded-lg border bg-white p-3 sm:p-4',
                  r.attendance_status === 'presente' ? 'border-ok/40' : r.attendance_status === 'ausente' ? 'border-erro/30' : 'border-pedra-200',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {canOpenSheet ? (
                      <Link href={`/encontristas/${r.id}`} className="block truncate text-base font-bold text-pedra-900 hover:underline">
                        {r.full_name}
                      </Link>
                    ) : (
                      <p className="truncate text-base font-bold text-pedra-900">{r.full_name}</p>
                    )}
                    <p className="mt-0.5 text-sm text-pedra-600">
                      {r.group_name ?? 'Sem tropa'} · camiseta <strong>{r.shirt_size ?? '—'}</strong>
                      {r.phone ? ` · ${r.phone.startsWith('•') ? r.phone : formatPhone(r.phone)}` : ''}
                    </p>
                  </div>
                  {r.attendance_status !== 'pendente' ? (
                    <span className={cn('shrink-0 rounded px-2 py-0.5 text-xs font-bold', r.attendance_status === 'presente' ? 'bg-ok-50 text-ok' : 'bg-erro-50 text-erro')}>
                      {r.attendance_status === 'presente' ? 'Presente' : 'Ausente'} {time(r.attendance_at)}
                    </span>
                  ) : null}
                </div>
                {canMark ? (
                  r.attendance_status === 'pendente' ? (
                    <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => mark(r, 'presente')}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-ok text-base font-bold text-white active:brightness-90 disabled:opacity-60"
                      >
                        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={3} />} Presente
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => mark(r, 'ausente')}
                        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg border border-pedra-300 px-4 text-sm font-bold text-pedra-700 active:bg-pedra-100 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" /> Ausente
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-pedra-500">
                      <span>Marcado por {r.attendance_by_name ?? '—'}</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => mark(r, 'pendente')}
                        className="inline-flex h-9 items-center gap-1 rounded-md px-2 font-bold text-manto hover:bg-manto-50"
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Desfazer
                      </button>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
