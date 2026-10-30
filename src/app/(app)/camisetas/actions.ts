'use server';

import { revalidatePath } from 'next/cache';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { done, fail, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';

export async function closeOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('camisetas.ver');
  const note = String(fd.get('note') ?? '').slice(0, 500);
  const { data, error } = await createClient().rpc('close_shirt_order', { p_note: note || null });
  if (error) return fail(friendlyError(error));
  revalidatePath('/camisetas');
  return done(`Pedido fechado: versão ${data}. As versões anteriores continuam guardadas.`);
}
