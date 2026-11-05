// Endereço da foto do recruta. O "v" muda quando a foto muda (cache do navegador).
export function photoUrl(id: string, path: string | null | undefined) {
  if (!path) return null;
  const v = path.split('/').pop()?.split('.')[0] ?? '1';
  return `/fotos/${id}?v=${v}`;
}
