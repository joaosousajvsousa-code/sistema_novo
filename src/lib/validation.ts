import { z } from 'zod';
import { onlyDigits, todayISO } from '@/lib/format';

export const requiredText = (label: string, min = 1, max = 200) =>
  z
    .string({ required_error: `Preencha ${label}.` })
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(min, `Preencha ${label}.`).max(max, `${label} pode ter no máximo ${max} caracteres.`));

export const optionalText = (max = 2000) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(max, `Use no máximo ${max} caracteres.`))
    .transform((v) => (v === '' ? null : v));

export const phoneRequired = z
  .string({ required_error: 'Informe o telefone com DDD.' })
  .transform(onlyDigits)
  .pipe(z.string().regex(/^\d{10,11}$/, 'Informe DDD + número, por exemplo (11) 98888-7777.'));

export const phoneOptional = z
  .string()
  .optional()
  .transform((v) => onlyDigits(v))
  .pipe(z.union([z.literal(''), z.string().regex(/^\d{10,11}$/, 'Informe DDD + número, por exemplo (11) 98888-7777.')]))
  .transform((v) => (v === '' ? null : v));

export const birthDate = z
  .string({ required_error: 'Informe a data de nascimento.' })
  .refine((v) => v !== 'invalida', 'Data inválida. Use DD/MM/AAAA.')
  .refine((v) => v === 'invalida' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Informe a data de nascimento.')
  .refine((v) => v >= '1900-01-01' && v <= todayISO(), 'Data de nascimento inválida.');

export const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim())
  .pipe(z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use DD/MM/AAAA.')]))
  .transform((v) => (v === '' ? null : v));

export const uuid = z.string().uuid('Registro inválido.');

export function formToObject(fd: FormData) {
  const out: Record<string, string> = {};
  fd.forEach((value, key) => {
    if (typeof value === 'string' && !key.startsWith('$ACTION')) out[key] = value;
  });
  return out;
}
