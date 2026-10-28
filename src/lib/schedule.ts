import { TIME_ZONE } from '@/config/app';

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  responsible: string | null;
  planned_start: string;
  planned_end: string;
  original_start: string;
  original_end: string;
  sort_order: number;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
};

export type ScheduleState = {
  items: ScheduleItem[];
  current: ScheduleItem | null;
  next: ScheduleItem | null;
  upcoming: ScheduleItem[];
  /** Atraso acumulado em minutos (positivo = atrasado). */
  delay: number;
  /** Minutos que a atividade atual já passou do término previsto. */
  overrun: number;
  /** Progresso da atividade atual, 0 a 1 (pode passar de 1). */
  progress: number;
  projectedStart: Record<string, string>;
};

const MIN = 60_000;
const t = (v: string) => new Date(v).getTime();

export function sortSchedule(items: ScheduleItem[]) {
  return [...items].sort((a, b) => t(a.planned_start) - t(b.planned_start) || a.sort_order - b.sort_order);
}

export function computeSchedule(raw: ScheduleItem[], nowMs = Date.now()): ScheduleState {
  const items = sortSchedule(raw);
  const current = items.find((i) => i.status === 'em_andamento') ?? null;
  const pending = items.filter((i) => i.status === 'agendada');
  const after = current ? pending.filter((i) => t(i.planned_start) >= t(current.planned_start)) : pending;
  const next = after[0] ?? pending[0] ?? null;

  let delay = 0;
  let overrun = 0;
  let progress = 0;
  if (current) {
    const duration = t(current.planned_end) - t(current.planned_start);
    const started = current.actual_start ? t(current.actual_start) : nowMs;
    const projectedEnd = Math.max(nowMs, started + duration);
    delay = Math.round((projectedEnd - t(current.planned_end)) / MIN);
    overrun = Math.max(0, Math.round((nowMs - t(current.planned_end)) / MIN));
    progress = duration > 0 ? (nowMs - started) / duration : 0;
  } else if (next && nowMs > t(next.planned_start)) {
    delay = Math.round((nowMs - t(next.planned_start)) / MIN);
  }

  const projectedStart: Record<string, string> = {};
  if (delay > 0) {
    for (const i of after) projectedStart[i.id] = new Date(t(i.planned_start) + delay * MIN).toISOString();
  }
  return { items, current, next, upcoming: after.slice(0, 5), delay, overrun, progress, projectedStart };
}

export function minutesBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.round((t(b) - t(a)) / MIN);
}

export function formatTime(v: string | null | undefined) {
  if (!v) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}

export function dayKey(v: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
}

export function formatDayLabel(v: string) {
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(v));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Duração legível: 12 min, 1h05, 2 dias e 3h.
export function formatDuration(min: number) {
  const abs = Math.abs(min);
  if (abs >= 1440) {
    const d = Math.floor(abs / 1440);
    const h = Math.floor((abs % 1440) / 60);
    return `${d} dia${d > 1 ? 's' : ''}${h ? ` e ${h}h` : ''}`;
  }
  if (abs >= 60) return `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
  return `${abs} min`;
}

export function formatDelay(min: number) {
  return min > 0 ? `${formatDuration(min)} de atraso` : min < 0 ? `${formatDuration(min)} adiantado` : 'No horário';
}

// Brasil sem horário de verão: São Paulo é sempre UTC−03:00.
export function localToIso(dateISO: string, time: string) {
  return new Date(`${dateISO}T${time}:00-03:00`).toISOString();
}

export function isoToLocalParts(v: string) {
  const d = new Date(v);
  const date = dayKey(v);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}
