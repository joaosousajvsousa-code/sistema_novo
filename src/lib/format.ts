import { TIME_ZONE } from '@/config/app';

export function onlyDigits(v: string | null | undefined) {
  return (v ?? '').replace(/\D/g, '');
}

export function formatPhone(v: string | null | undefined) {
  const d = onlyDigits(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? '';
}

export function whatsappLink(v: string | null | undefined) {
  const d = onlyDigits(v);
  return d ? `https://wa.me/55${d}` : null;
}

// Datas sem horário vêm como 'AAAA-MM-DD'; formata sem passar por fuso.
export function formatDate(v: string | null | undefined) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatDateTime(v: string | null | undefined) {
  if (!v) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(v));
}

export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts;
}

export function ageOn(birth: string | null | undefined, refISO = todayISO()) {
  if (!birth) return null;
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ry, rm, rd] = refISO.split('-').map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;
  return age;
}

export function formatDateRange(start?: string | null, end?: string | null) {
  if (start && end && start !== end) return `${formatDate(start)} a ${formatDate(end)}`;
  return formatDate(start ?? end ?? '');
}
