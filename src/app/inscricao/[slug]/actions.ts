'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { appErrorCode, friendlyError } from '@/lib/errors';
import { birthDate, phoneRequired, requiredText } from '@/lib/validation';

const schema = z.object({
  slug: z.string().min(6).max(80),
  full_name: requiredText('o nome completo', 3, 150),
  phone: phoneRequired,
  birth_date: birthDate,
  shirt_size: z.string().min(1, 'Escolha o tamanho da camiseta.'),
  consent: z.literal('on', { errorMap: () => ({ message: 'É preciso concordar para concluir a inscrição.' }) }),
});

export async function publicRegister(_: ActionState, fd: FormData): Promise<ActionState> {
  // Campo invisível: robôs costumam preencher. Pessoas não veem.
  if (String(fd.get('website') ?? '') !== '') return done('Inscrição recebida.');

  const parsed = schema.safeParse({
    slug: fd.get('slug'),
    full_name: fd.get('full_name'),
    phone: fd.get('phone') ?? '',
    birth_date: fd.get('birth_date') ?? '',
    shirt_size: fd.get('shirt_size') ?? '',
    consent: fd.get('consent') ?? '',
  });
  if (!parsed.success) return fromZod(parsed.error);

  const extra: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (k.startsWith('extra.') && typeof v === 'string') extra[k.slice(6)] = v.trim().slice(0, 300);
  });

  const supabase = createClient();
  const { error } = await supabase.rpc('public_register_servidor', {
    p_slug: parsed.data.slug,
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_birth_date: parsed.data.birth_date,
    p_shirt_size: parsed.data.shirt_size,
    p_extra: extra,
    p_consent: true,
  });
  if (error) {
    const code = appErrorCode(error);
    const msg = friendlyError(error, 'Não foi possível enviar a inscrição. Verifique a internet e tente de novo.');
    if (code === 'TELEFONE_INVALIDO') return fail('Confira os campos destacados.', { phone: msg });
    if (code === 'DATA_NASCIMENTO_INVALIDA') return fail('Confira os campos destacados.', { birth_date: msg });
    if (code === 'TAMANHO_INVALIDO') return fail('Confira os campos destacados.', { shirt_size: msg });
    if (code === 'SEM_VAGAS' || code === 'INSCRICOES_FECHADAS') return { ok: false, error: msg, data: { closed: true }, ts: Date.now() };
    return fail(msg);
  }
  return done('Inscrição recebida.', { name: parsed.data.full_name.split(' ')[0] });
}
