'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient, adminConfigured } from '@/lib/supabase/admin';
import { fail, fromZod, type ActionState } from '@/lib/action';
import { newPasswordSchema } from '@/lib/password';
import { requiredText } from '@/lib/validation';
import { normalizeUsername, USERNAME_PATTERN, usernameToEmail } from '@/config/app';

function sameSecret(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const schema = z.object({
  full_name: requiredText('o nome', 2, 120),
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(USERNAME_PATTERN, 'Use de 3 a 32 letras minúsculas, números, ponto, hífen ou sublinhado.')),
});

export async function createFirstAdmin(_: ActionState, fd: FormData): Promise<ActionState> {
  const expected = process.env.INITIAL_SETUP_CODE ?? '';
  if (!adminConfigured() || expected.length < 8) return fail('A configuração inicial não está habilitada neste servidor.');
  if (!sameSecret(String(fd.get('code') ?? ''), expected)) {
    return fail('Confira os campos destacados.', { code: 'Código de configuração incorreto.' });
  }
  const parsed = schema.safeParse({ full_name: fd.get('full_name'), username: fd.get('username') });
  if (!parsed.success) return fromZod(parsed.error);
  const pw = newPasswordSchema.safeParse({ password: fd.get('password'), confirm: fd.get('confirm') });
  if (!pw.success) return fromZod(pw.error);

  const admin = createAdminClient();
  const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true });
  if (countError) return fail('Não foi possível acessar o banco. Confira se a migração foi executada no Supabase.');
  if ((count ?? 0) > 0) return fail('O sistema já foi configurado. Entre pela tela de login.');

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(parsed.data.username),
    password: pw.data.password,
    email_confirm: true,
    user_metadata: { username: parsed.data.username },
  });
  if (createError || !created.user) return fail('Não foi possível criar o usuário no Supabase Auth.');

  const userId = created.user.id;
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: userId, username: parsed.data.username, full_name: parsed.data.full_name, must_change_password: false });
  const { error: roleError } = profileError
    ? { error: profileError }
    : await admin.from('user_roles').insert({ user_id: userId, role_key: 'admin' });
  if (profileError || roleError) {
    await admin.auth.admin.deleteUser(userId);
    return fail('Não foi possível concluir a configuração. Nada foi salvo; tente de novo.');
  }
  redirect('/login?motivo=admin');
}
