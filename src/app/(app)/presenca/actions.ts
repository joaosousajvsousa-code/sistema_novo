'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/errors';

export async function markAttendance(id: string, status: 'pendente' | 'presente' | 'ausente') {
  await requireAccess();
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(['pendente', 'presente', 'ausente']) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: 'Ação inválida.' };
  const { error } = await createClient().rpc('set_attendance', { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/presenca');
  return { ok: true, at: new Date().toISOString() };
}
