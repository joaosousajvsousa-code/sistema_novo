export type ShirtRow = { kind: string; person: string; size: string | null; where: string };
export const NO_SIZE = 'Sem tamanho';

// Ordena os tamanhos pela ordem configurada no acampamento.
export function sizeOrder(configured: string[], found: string[]) {
  const extra = found.filter((s) => s !== NO_SIZE && !configured.includes(s)).sort();
  const list = [...configured, ...extra];
  return found.includes(NO_SIZE) ? [...list, NO_SIZE] : list;
}

export function countBy(rows: ShirtRow[]) {
  const bySize: Record<string, number> = {};
  const byWhere: Record<string, { kind: string; sizes: Record<string, number>; total: number }> = {};
  for (const r of rows) {
    const s = r.size || NO_SIZE;
    bySize[s] = (bySize[s] ?? 0) + 1;
    const key = `${r.kind}|${r.where}`;
    byWhere[key] ??= { kind: r.kind, sizes: {}, total: 0 };
    byWhere[key].sizes[s] = (byWhere[key].sizes[s] ?? 0) + 1;
    byWhere[key].total++;
  }
  return { bySize, byWhere };
}
