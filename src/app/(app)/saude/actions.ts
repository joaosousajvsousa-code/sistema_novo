'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireCheck, canAny, getAccess } from '@/lib/auth';
import { canManageMeds } from '@/lib/meds';
import { createClient } from '@/lib/supabase/server';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';
import { optionalDate, optionalText, requiredText, uuid } from '@/lib/validation';
import { parseTimes } from '@/lib/meds';

export type DoseResult = { ok: true; at: string } | { ok: false; error: string };

export async function markDose(plan: string, date: string, time: string, status: 'dado' | 'nao_dado' | 'pendente'): Promise<DoseResult> {
  const access = await getAccess();
  if (!access || !canAny(access, ['saude.ver', 'saude.medicar'])) return { ok: false, error: 'Você não tem permissão para esta ação.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) return { ok: false, error: 'Horário inválido.' };
  const { error } = await createClient().rpc('mark_medication_dose', { p_plan: plan, p_date: date, p_time: time, p_status: status, p_note: null });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath('/saude');
  return { ok: true, at: new Date().toISOString() };
}

const schema = z.object({
  id: uuid.optional(),
  encontrista_id: uuid,
  medication: requiredText('o nome do remédio', 1, 120),
  dose: optionalText(120),
  times: z.string(),
  start_date: optionalDate,
  end_date: optionalDate,
  instructions: optionalText(500),
});

export async function savePlan(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireCheck(canManageMeds);
  const p = schema.safeParse({
    id: fd.get('id') || undefined,
    encontrista_id: fd.get('encontrista_id') ?? '',
    medication: fd.get('medication') ?? '',
    dose: fd.get('dose') ?? '',
    times: fd.get('times') ?? '',
    start_date: fd.get('start_date') ?? '',
    end_date: fd.get('end_date') ?? '',
    instructions: fd.get('instructions') ?? '',
  });
  if (!p.success) {
    const st = fromZod(p.error);
    if (!fd.get('encontrista_id')) return fail('Escolha o recruta.', { ...st.fieldErrors, encontrista_id: 'Escolha o recruta.' });
    return st;
  }
  const { times, invalid } = parseTimes(p.data.times);
  if (invalid.length) return fail(`Horário inválido: ${invalid.join(', ')}. Use, por exemplo, 08:00, 14:00, 20:00.`, { times: 'Use o formato 08:00, separados por vírgula.' });
  if (!times.length) return fail('Informe pelo menos um horário.', { times: 'Informe pelo menos um horário.' });
  if (p.data.start_date && p.data.end_date && p.data.end_date < p.data.start_date) return fail('A data final é antes da inicial.', { end_date: 'Antes da data inicial.' });

  const { error } = await createClient().rpc('save_medication_plan', {
    p_id: p.data.id ?? null,
    p_encontrista: p.data.encontrista_id,
    p_medication: p.data.medication,
    p_dose: p.data.dose,
    p_times: times,
    p_start: p.data.start_date,
    p_end: p.data.end_date,
    p_instructions: p.data.instructions,
  });
  if (error) return fail(friendlyError(error));
  revalidatePath('/saude');
  revalidatePath(`/encontristas/${p.data.encontrista_id}`);
  if (fd.get('next') === 'another') redirect(`/saude/novo?salvo=${Date.now()}`);
  redirect('/saude?salvo=1');
}

export async function setPlanActive(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireCheck(canManageMeds);
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Registro inválido.');
  const active = fd.get('active') === 'true';
  const { error } = await createClient().rpc('set_medication_plan_active', { p_id: id.data, p_active: active });
  if (error) return fail(friendlyError(error));
  revalidatePath('/saude');
  return done(active ? 'Remédio reativado.' : 'Remédio suspenso. Ele sai do cronograma, mas as doses já marcadas ficam guardadas.');
}
