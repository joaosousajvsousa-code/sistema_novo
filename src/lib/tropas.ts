// Imagens das tropas (public/tropas/<chave>.webp).
export const TROPA_IMAGES = [
  { key: 'jerico', label: 'Jericó' },
  { key: 'hebrom', label: 'Hebrom' },
  { key: 'gileade', label: 'Gileade' },
  { key: 'siao', label: 'Sião' },
  { key: 'canaa', label: 'Canaã' },
  { key: 'jordao', label: 'Jordão' },
  { key: 'carmel', label: 'Carmel' },
  { key: 'betel', label: 'Betel' },
] as const;
export type TropaImage = (typeof TROPA_IMAGES)[number]['key'];
export const TROPA_KEYS = TROPA_IMAGES.map((t) => t.key) as readonly string[];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Imagem escolhida ou, se não houver, a que combina com o nome.
export function tropaImage(g: { image?: string | null; name: string }): string | null {
  if (g.image && TROPA_KEYS.includes(g.image)) return `/tropas/${g.image}.webp`;
  const n = norm(g.name);
  const hit = TROPA_IMAGES.find((t) => n.includes(t.key) || n.includes(norm(t.label)));
  return hit ? `/tropas/${hit.key}.webp` : null;
}
