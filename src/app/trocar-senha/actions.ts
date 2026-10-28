'use server';

import { redirect } from 'next/navigation';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createClient, noStoreFetch } from '@/lib/supabase/server';
import { getAccess } from '@/lib/auth';
import { fail, fromZod, type ActionState } from '@/lib/action';
import { newPasswordSchema } from '@/lib/password';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { usernameToEmail } from '@/config/app';

async function applyNewPassword(password: string): Promise<ActionState | null> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.message?.toLowerCase().includes('different from the old')) return fail('A nova senha precisa ser diferente da atual.');
    if (error.message?.toLowerCase().includes('weak')) return fail('Senha muito fraca. Use uma combinação mais longa.');
    return fail('Não foi possível alterar a senha. Tente de novo.');
  }
  const { error: markError } = await supabase.rpc('mark_password_changed');
  if (markError) return fail('A senha foi alterada, mas não foi possível concluir. Recarregue a página.');
  return null;
}

// Primeiro acesso ou senha temporária: não exige a senha atual.
export async function forcedChangePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await getAccess();
  if (!access) redirect('/login');
  const parsed = newPasswordSchema.safeParse({ password: fd.get('password'), confirm: fd.get('confirm') });
  if (!parsed.success) return fromZod(parsed.error);
  const err = await applyNewPassword(parsed.data.password);
  if (err) return err;
  redirect('/painel');
}

// Troca voluntária: confere a senha atual antes.
export async function changeOwnPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await getAccess();
  if (!access) redirect('/login');
  const current = String(fd.get('current') ?? '');
  if (!current) return fail('Confira os campos destacados.', { current: 'Informe a senha atual.' });
  const parsed = newPasswordSchema.safeParse({ password: fd.get('password'), confirm: fd.get('confirm') });
  if (!parsed.success) return fromZod(parsed.error);

  const checker = createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
  const { error: checkError } = await checker.auth.signInWithPassword({ email: usernameToEmail(access.username), password: current });
  if (checkError) {
    if (checkError.status === 429) return fail('Muitas tentativas. Aguarde alguns minutos.');
    return fail('Confira os campos destacados.', { current: 'Senha atual incorreta.' });
  }
  await checker.auth.signOut();

  const err = await applyNewPassword(parsed.data.password);
  if (err) return err;
  return { ok: true, message: 'Senha alterada.', ts: Date.now() };
}
