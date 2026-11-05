import { can, type Access } from '@/lib/auth';

// Horários de remédio: aceita "8h, 14:30 e 20" e devolve ["08:00","14:30","20:00"].
export function parseTimes(text: string): { times: string[]; invalid: string[] } {
  const parts = text
    .split(/[,;\n]|\se\s/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const times = new Set<string>();
  const invalid: string[] = [];
  for (const p of parts) {
    const m = /^(\d{1,2})(?:\s*[:hH.]\s*(\d{2})?)?\s*(?:h|hs|horas)?$/.exec(p);
    const h = m ? Number(m[1]) : NaN;
    const min = m && m[2] ? Number(m[2]) : 0;
    if (!m || h > 23 || min > 59) invalid.push(p);
    else times.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return { times: Array.from(times).sort(), invalid };
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

// Cadastrar/alterar remédios: mesma regra de editar a saúde do recruta.
export const canManageMeds = (a: Access) => can(a, 'saude.ver') && can(a, 'encontristas.editar');
export const canViewMeds = (a: Access) => can(a, 'saude.ver') || can(a, 'saude.medicar');
