'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { done, fail, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';
import { uuid } from '@/lib/validation';
import { parseBRL } from '@/lib/money';
import { storeDocument } from '@/lib/documents';
import { todayISO } from '@/lib/format';

const METHODS = ['pix', 'dinheiro', 'cartao', 'transferencia', 'outro'] as const;

export async function savePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requireAccess();
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Inscrição inválida.');
  const expected = parseBRL(String(fd.get('expected') ?? ''));
  const paid = parseBRL(String(fd.get('paid') ?? ''));
  const errors: Record<string, string> = {};
  if (expected === 'invalido' || (typeof expected === 'number' && expected < 0)) errors.expected = 'Valor inválido. Ex.: 150,00';
  if (paid === 'invalido' || (typeof paid === 'number' && paid < 0)) errors.paid = 'Valor inválido. Ex.: 150,00';
  const rawDate = String(fd.get('date') ?? '');
  if (rawDate === 'invalida') errors.date = 'Data inválida. Use DD/MM/AAAA.';
  else if (rawDate && rawDate > todayISO()) errors.date = 'A data do pagamento não pode ser no futuro.';
  const methodRaw = String(fd.get('method') ?? '');
  const method = z.enum(METHODS).safeParse(methodRaw);
  if (methodRaw && !method.success) errors.method = 'Escolha a forma de pagamento.';
  const file = fd.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (Object.keys(errors).length) return fail('Confira os campos destacados.', errors);

  const supabase = createClient();
  const { data: m } = await supabase.from('service_team_memberships').select('id, camp_id').eq('id', id.data).maybeSingle();
  if (!m) return fail('Inscrição não encontrada.');
  const { data: allowed } = await supabase.rpc('can_view_payment', { p_membership: id.data });
  if (!allowed) return fail('Você não tem permissão para registrar este pagamento.');

  // Comprovante primeiro: assim a situação já vira "comprovante enviado".
  if (hasFile) {
    const up = await storeDocument({ file: file as File, campId: m.camp_id, entity: 'pagamento', entityId: id.data, userId: access.userId });
    if (up.error) return fail('Confira os campos destacados.', { file: up.error });
  }
  const { error } = await supabase.rpc('register_payment', {
    p_id: id.data,
    p_expected: expected,
    p_paid: paid,
    p_date: rawDate || null,
    p_method: method.success ? method.data : null,
    p_notes: String(fd.get('notes') ?? '').slice(0, 1000),
  });
  if (error) return fail(friendlyError(error));
  revalidatePath(`/servidores/${id.data}`);
  revalidatePath('/financeiro');
  return done(hasFile ? 'Pagamento e comprovante salvos.' : 'Pagamento salvo.');
}

const STATUS_MSG = {
  confirmado: 'Pagamento confirmado.',
  isento: 'Marcado como isento.',
  estornado: 'Pagamento estornado. O valor saiu das receitas.',
  pendente: 'Pagamento voltou para pendente.',
} as const;

export async function changePaymentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAccess();
  const id = uuid.safeParse(fd.get('id'));
  const status = z.enum(['confirmado', 'isento', 'estornado', 'pendente']).safeParse(fd.get('status'));
  if (!id.success || !status.success) return fail('Ação inválida.');
  const supabase = createClient();
  const { error } = await supabase.rpc('set_payment_status', {
    p_id: id.data,
    p_status: status.data,
    p_note: String(fd.get('note') ?? '').slice(0, 300) || null,
  });
  if (error) return fail(friendlyError(error));
  revalidatePath(`/servidores/${id.data}`);
  revalidatePath('/financeiro');
  revalidatePath('/financeiro/pagamentos');
  return done(STATUS_MSG[status.data]);
}
