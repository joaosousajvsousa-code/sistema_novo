'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';
import { optionalText, requiredText, uuid } from '@/lib/validation';
import { parseBRL } from '@/lib/money';
import { storeDocument } from '@/lib/documents';

const KIND = z.enum(['receita', 'despesa']);

const entrySchema = z.object({
  kind: KIND,
  category_id: z.string().uuid('Escolha a categoria.'),
  team_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().uuid().nullable()),
  description: requiredText('a descrição', 2, 200),
  entry_date: z
    .string()
    .refine((v) => v !== 'invalida', 'Data inválida. Use DD/MM/AAAA.')
    .refine((v) => v === 'invalida' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Informe a data.'),
  responsible: optionalText(120),
  notes: optionalText(1000),
});

function readEntry(fd: FormData) {
  const parsed = entrySchema.safeParse({
    kind: fd.get('kind'),
    category_id: fd.get('category_id') ?? '',
    team_id: fd.get('team_id') ?? '',
    description: fd.get('description'),
    entry_date: fd.get('entry_date') ?? '',
    responsible: fd.get('responsible') ?? '',
    notes: fd.get('notes') ?? '',
  });
  const amount = parseBRL(String(fd.get('amount') ?? ''));
  const amountError = amount === null ? 'Informe o valor.' : amount === 'invalido' || amount <= 0 ? 'Valor inválido. Ex.: 150,00' : null;
  return { parsed, amount: typeof amount === 'number' ? amount : 0, amountError };
}

function withAmountError(state: ActionState, amountError: string | null): ActionState {
  if (!amountError) return state;
  return { ...state, fieldErrors: { ...(state.fieldErrors ?? {}), amount: amountError } };
}

export async function createEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('financeiro.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return fail('Acampamento não encontrado.');
  const { parsed, amount, amountError } = readEntry(fd);
  if (!parsed.success) return withAmountError(fromZod(parsed.error), amountError);
  if (amountError) return fail('Confira os campos destacados.', { amount: amountError });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('finance_entries')
    .insert({ ...parsed.data, amount, camp_id: camp.id, created_by: access.userId, updated_by: access.userId })
    .select('id')
    .single();
  if (error || !data) return fail(friendlyError(error));
  const file = fd.get('file');
  if (file instanceof File && file.size > 0) {
    const up = await storeDocument({ file, campId: camp.id, entity: parsed.data.kind, entityId: data.id, userId: access.userId });
    if (up.error) {
      revalidatePath('/financeiro', 'layout');
      redirect(`/financeiro/lancamentos/${data.id}?aviso=comprovante`);
    }
  }
  revalidatePath('/financeiro', 'layout');
  if (fd.get('next') === 'another') redirect(`/financeiro/lancamentos/novo?tipo=${parsed.data.kind}&salvo=${Date.now()}`);
  redirect(`/financeiro/lancamentos?tipo=${parsed.data.kind}&salvo=1`);
}

export async function updateEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('financeiro.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Lançamento inválido.');
  const { parsed, amount, amountError } = readEntry(fd);
  if (!parsed.success) return withAmountError(fromZod(parsed.error), amountError);
  if (amountError) return fail('Confira os campos destacados.', { amount: amountError });
  const { kind: _kind, ...rest } = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('finance_entries')
    .update({ ...rest, amount, updated_by: access.userId })
    .eq('id', id.data)
    .is('cancelled_at', null)
    .select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível salvar. O lançamento pode estar cancelado.');
  revalidatePath('/financeiro', 'layout');
  return done('Lançamento salvo.');
}

export async function cancelEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('financeiro.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Lançamento inválido.');
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 300);
  if (reason.length < 3) return fail('Confira os campos destacados.', { reason: 'Informe o motivo do cancelamento.' });
  const supabase = createClient();
  const { data, error } = await supabase
    .from('finance_entries')
    .update({ cancelled_at: new Date().toISOString(), cancelled_by: access.userId, cancel_reason: reason, updated_by: access.userId })
    .eq('id', id.data)
    .is('cancelled_at', null)
    .select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível cancelar.');
  revalidatePath('/financeiro', 'layout');
  return done('Lançamento cancelado. Ele não conta mais nos totais.');
}

export async function addEntryDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('financeiro.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Lançamento inválido.');
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Confira os campos destacados.', { file: 'Escolha um arquivo.' });
  const supabase = createClient();
  const { data: entry } = await supabase.from('finance_entries').select('id, camp_id, kind').eq('id', id.data).maybeSingle();
  if (!entry) return fail('Lançamento não encontrado.');
  const up = await storeDocument({ file, campId: entry.camp_id, entity: entry.kind as 'receita' | 'despesa', entityId: entry.id, userId: access.userId });
  if (up.error) return fail('Confira os campos destacados.', { file: up.error });
  revalidatePath(`/financeiro/lancamentos/${entry.id}`);
  return done('Comprovante anexado.');
}

export async function saveBudgets(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('financeiro.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return fail('Acampamento não encontrado.');
  const errors: Record<string, string> = {};
  const upserts: { camp_id: string; category_id: string; amount: number; updated_by: string; updated_at: string }[] = [];
  const removes: string[] = [];
  fd.forEach((value, key) => {
    if (!key.startsWith('budget.')) return;
    const categoryId = key.slice(7);
    if (!uuid.safeParse(categoryId).success) return;
    const v = parseBRL(String(value));
    if (v === 'invalido' || (typeof v === 'number' && v < 0)) errors[key] = 'Valor inválido.';
    else if (v === null) removes.push(categoryId);
    else upserts.push({ camp_id: camp.id, category_id: categoryId, amount: v, updated_by: access.userId, updated_at: new Date().toISOString() });
  });
  if (Object.keys(errors).length) return fail('Confira os campos destacados.', errors);
  const supabase = createClient();
  if (upserts.length) {
    // Atualiza os que já existem e cria os novos (sem "upsert", que exigiria
    // permissão de alterar o acampamento e a categoria do orçamento).
    const { data: existing } = await supabase.from('finance_budgets').select('category_id').eq('camp_id', camp.id);
    const have = new Set((existing ?? []).map((b) => b.category_id as string));
    const inserts = upserts.filter((u) => !have.has(u.category_id));
    for (const u of upserts.filter((x) => have.has(x.category_id))) {
      const { error } = await supabase
        .from('finance_budgets')
        .update({ amount: u.amount, updated_by: u.updated_by, updated_at: u.updated_at })
        .eq('camp_id', camp.id)
        .eq('category_id', u.category_id);
      if (error) return fail(friendlyError(error));
    }
    if (inserts.length) {
      const { error } = await supabase.from('finance_budgets').insert(inserts);
      if (error) return fail(friendlyError(error));
    }
  }
  if (removes.length) {
    const { error } = await supabase.from('finance_budgets').delete().eq('camp_id', camp.id).in('category_id', removes);
    if (error) return fail(friendlyError(error));
  }
  revalidatePath('/financeiro', 'layout');
  return done('Orçamento salvo.');
}

export async function createCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('financeiro.gerenciar');
  const kind = KIND.safeParse(fd.get('kind'));
  const name = requiredText('o nome da categoria', 2, 60).safeParse(fd.get('name') ?? '');
  if (!kind.success) return fail('Tipo inválido.');
  if (!name.success) return fromZod(name.error);
  const supabase = createClient();
  const { error } = await supabase.from('finance_categories').insert({ kind: kind.data, name: name.data });
  if (error) {
    if (error.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe uma categoria com este nome.' });
    return fail(friendlyError(error));
  }
  revalidatePath('/financeiro', 'layout');
  return done('Categoria criada.');
}

export async function toggleCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('financeiro.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Categoria inválida.');
  const active = fd.get('active') === 'true';
  const supabase = createClient();
  const { data, error } = await supabase.from('finance_categories').update({ active }).eq('id', id.data).select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível alterar a categoria.');
  revalidatePath('/financeiro', 'layout');
  return done(active ? 'Categoria reativada.' : 'Categoria desativada. Os lançamentos antigos continuam com ela.');
}

export async function saveBankBalance(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('financeiro.gerenciar');
  const raw = String(fd.get('amount') ?? '');
  const v = parseBRL(raw);
  if (v === 'invalido') return fail('Confira os campos destacados.', { amount: 'Valor inválido. Ex.: 1.250,00' });
  const date = String(fd.get('date') ?? '');
  if (date === 'invalida') return fail('Confira os campos destacados.', { date: 'Data inválida. Use DD/MM/AAAA.' });
  const supabase = createClient();
  const { error } = await supabase.rpc('set_bank_balance', { p_amount: v, p_date: date || null });
  if (error) return fail(friendlyError(error));
  revalidatePath('/financeiro');
  return done(v === null ? 'Saldo bancário removido.' : 'Saldo bancário salvo.');
}
