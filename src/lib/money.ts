// Valores em reais. Aceita "1.234,56", "1234,56", "1234.56", "R$ 50".
export function parseBRL(raw: string | null | undefined): number | null | 'invalido' {
  let v = (raw ?? '').replace(/R\$|\s/g, '').trim();
  if (!v) return null;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(v)) return 'invalido';
  return Math.round(Number(v) * 100) / 100;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '';
  return fmt.format(Number(v));
}

// Valor para preencher um campo de texto: 1234.5 → "1234,50".
export function toInputBRL(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toFixed(2).replace('.', ',');
}
