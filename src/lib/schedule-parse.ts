// Leitura do cronograma colado: uma linha por momento.
// Formatos aceitos:
//   07:30 Café da manhã
//   07:30 - 08:00 Café da manhã
//   7h30 às 8h Café da manhã | Refeitório | Equipe Cozinha
// Sem término, o momento vai até o início do próximo (o último dura 30 min).
// Horário menor que o anterior passa para o dia seguinte (ex.: 23:00 → 00:30).

export type ParsedLine = {
  line: number;
  title: string;
  location: string | null;
  responsible: string | null;
  startMin: number; // minutos desde 00:00 do dia escolhido (pode passar de 1440)
  endMin: number;
};

export type ParseResult = { items: ParsedLine[]; errors: { line: number; text: string; message: string }[] };

const TIME = String.raw`(\d{1,2})(?:[:hH.](\d{2})|[hH])`;
const LINE = new RegExp(String.raw`^\s*${TIME}\s*(?:(?:-|–|—|a|às|as|até|ate)\s*${TIME})?\s*(?:[-–—:|]\s*)?(.*)$`, 'i');

function toMin(h: string, m: string | undefined) {
  const hh = Number(h);
  const mm = Number(m ?? '0');
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export function parseSchedule(text: string, maxLines = 200): ParseResult {
  const items: ParsedLine[] = [];
  const errors: ParseResult['errors'] = [];
  const raw: { line: number; start: number; end: number | null; title: string; location: string | null; responsible: string | null }[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((l, idx) => {
    const t = l.trim();
    if (!t) return;
    const m = LINE.exec(t);
    if (!m) {
      errors.push({ line: idx + 1, text: t, message: 'Comece a linha com o horário, ex.: 07:30 Café da manhã' });
      return;
    }
    const start = toMin(m[1], m[2]);
    const end = m[3] !== undefined ? toMin(m[3], m[4]) : null;
    if (start === null || (m[3] !== undefined && end === null)) {
      errors.push({ line: idx + 1, text: t, message: 'Horário inválido' });
      return;
    }
    const [title, location, responsible] = m[5].split('|').map((p) => p.trim());
    if (!title || title.length < 2) {
      errors.push({ line: idx + 1, text: t, message: 'Falta o nome do momento depois do horário' });
      return;
    }
    if (title.length > 120) {
      errors.push({ line: idx + 1, text: t, message: 'Nome com mais de 120 caracteres' });
      return;
    }
    raw.push({ line: idx + 1, start, end, title, location: location?.slice(0, 120) || null, responsible: responsible?.slice(0, 120) || null });
  });
  if (raw.length > maxLines) {
    errors.push({ line: 0, text: '', message: `Cole no máximo ${maxLines} momentos de uma vez.` });
    return { items: [], errors };
  }

  // Dia seguinte quando o horário "volta" (passou da meia-noite).
  let offset = 0;
  let prev = -1;
  const starts = raw.map((r) => {
    let s = r.start + offset;
    if (prev >= 0 && s < prev) {
      offset += 1440;
      s += 1440;
    }
    prev = s;
    return s;
  });
  raw.forEach((r, i) => {
    const s = starts[i];
    let e: number;
    if (r.end !== null) {
      e = r.end + (s - r.start);
      if (e <= s) e += 1440;
    } else {
      e = i + 1 < starts.length && starts[i + 1] > s ? starts[i + 1] : s + 30;
    }
    items.push({ line: r.line, title: r.title, location: r.location, responsible: r.responsible, startMin: s, endMin: e });
  });
  return { items, errors };
}

export function minToLabel(min: number) {
  const day = Math.floor(min / 1440);
  const m = min % 1440;
  const label = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return day > 0 ? `${label} (+${day}d)` : label;
}
