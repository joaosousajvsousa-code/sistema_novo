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

const schema = z.object({
  name: requiredText('o nome do grupo', 1, 80),
  description: optionalText(1000),
  responsaveis: optionalText(300),
  capacity: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .pipe(z.union([z.literal(''), z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1.').max(2000, 'Máximo de 2000.')]))
    .transform((v) => (v === '' ? null : v)),
  notes: optionalText(2000),
});

function read(fd: FormData) {
  return schema.safeParse({
    name: fd.get('name'),
    description: fd.get('description') ?? '',
    responsaveis: fd.get('responsaveis') ?? '',
    capacity: fd.get('capacity') ?? '',
    notes: fd.get('notes') ?? '',
  });
}

export async function createGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('grupos.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return fail('Nenhum acampamento ativo.');
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = createClient();
  const { error } = await supabase.from('participant_groups').insert({ ...parsed.data, camp_id: camp.id, created_by: access.userId });
  if (error) {
    if (error.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe um grupo com este nome.' });
    return fail(friendlyError(error));
  }
  revalidatePath('/grupos');
  return done('Grupo criado.');
}

export async function updateGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Grupo inválido.');
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = createClient();
  const { data, error } = await supabase.from('participant_groups').update(parsed.data).eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe um grupo com este nome.' });
    const msg = friendlyError(error);
    if (msg.includes('limite')) return fail('Confira os campos destacados.', { capacity: msg });
    return fail(msg);
  }
  if (!data?.length) return fail('Não foi possível salvar o grupo.');
  revalidatePath(`/grupos/${id.data}`);
  revalidatePath('/grupos');
  return done('Grupo salvo.');
}

export async function deleteGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Grupo inválido.');
  const supabase = createClient();
  const { data, error } = await supabase.from('participant_groups').delete().eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23503') return fail('O grupo ainda tem integrantes. Remova ou realoque todos antes de excluir.');
    return fail(friendlyError(error));
  }
  if (!data?.length) return fail('Não foi possível excluir o grupo.');
  revalidatePath('/grupos');
  redirect('/grupos');
}

export async function assignMany(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const ids = fd
    .getAll('ids')
    .map(String)
    .filter((v) => uuid.safeParse(v).success);
  if (!ids.length) return fail('Selecione pelo menos um encontrista.');
  const raw = String(fd.get('group_id') ?? '');
  if (raw !== 'remover' && !uuid.safeParse(raw).success) return fail('Confira os campos destacados.', { group_id: 'Escolha o grupo de destino.' });
  const supabase = createClient();
  const { data, error } = await supabase.rpc('assign_encontristas', { p_ids: ids, p_group: raw === 'remover' ? null : raw });
  if (error) return fail(friendlyError(error));
  revalidatePath('/grupos');
  revalidatePath('/grupos/distribuir');
  revalidatePath('/encontristas');
  const n = Number(data ?? 0);
  return done(raw === 'remover' ? `${n} encontrista(s) removido(s) do grupo.` : `${n} encontrista(s) atribuído(s) ao grupo.`);
}
