import { z } from 'zod';

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
      .max(72, 'Use no máximo 72 caracteres.')
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letras e números na senha.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'As senhas não conferem.', path: ['confirm'] });

// Senha temporária legível (sem caracteres ambíguos) para o admin repassar.
export function generateTempPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 10; i++) {
    const set = i % 5 === 4 ? digits : letters;
    out += set[bytes[i] % set.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}
