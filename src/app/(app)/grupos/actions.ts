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
  name: requiredText('o nome da tropa', 1, 80),
  description: optionalText(1000),
  capacity: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .pipe(z.union([z.literal(''), z.coerce.number().int('Use um número inteiro.').min(1, 'Mínimo de 1.').max(2000, 'Máximo de 2000.')]))
    .transform((v) => (v === '' ? null : v)),
  notes: optionalText(2000),
});

function readLeaders(fd: FormData) {
  return fd
    .getAll('leaders')
    .map(String)
    .filter((v) => uuid.safeParse(v).success);
}

async function saveLeaders(groupId: string, fd: FormData) {
  // Sem a lista no formulário (equipe Tenente inexistente), não mexe nos tenentes.
  if (!fd.has('leaders') && fd.get('leaders_present') !== '1') return null;
  const { error } = await createClient().rpc('set_group_leaders', { p_group: groupId, p_memberships: readLeaders(fd) });
  return error;
}

function read(fd: FormData) {
  return schema.safeParse({
    name: fd.get('name'),
    description: fd.get('description') ?? '',
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
  const { data: created, error } = await supabase
    .from('participant_groups')
    .insert({ ...parsed.data, camp_id: camp.id, created_by: access.userId })
    .select('id')
    .single();
  if (error || !created) {
    if (error?.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe uma tropa com este nome.' });
    return fail(friendlyError(error));
  }
  const leadersError = await saveLeaders(created.id, fd);
  revalidatePath('/grupos');
  if (leadersError) return fail(`A tropa foi criada, mas os tenentes não foram salvos: ${friendlyError(leadersError)}`);
  return done('Tropa criada.');
}

export async function updateGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Tropa inválida.');
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = createClient();
  const { data, error } = await supabase.from('participant_groups').update(parsed.data).eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe uma tropa com este nome.' });
    const msg = friendlyError(error);
    if (msg.includes('limite')) return fail('Confira os campos destacados.', { capacity: msg });
    return fail(msg);
  }
  if (!data?.length) return fail('Não foi possível salvar a tropa.');
  const leadersError = await saveLeaders(id.data, fd);
  if (leadersError) return fail(friendlyError(leadersError));
  revalidatePath(`/grupos/${id.data}`);
  revalidatePath('/grupos');
  return done('Tropa salva.');
}

export async function deleteGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Tropa inválida.');
  const supabase = createClient();
  const { data, error } = await supabase.from('participant_groups').delete().eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23503') return fail('A tropa ainda tem integrantes. Remova ou realoque todos antes de excluir.');
    return fail(friendlyError(error));
  }
  if (!data?.length) return fail('Não foi possível excluir a tropa.');
  revalidatePath('/grupos');
  redirect('/grupos');
}

export async function assignMany(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const ids = fd
    .getAll('ids')
    .map(String)
    .filter((v) => uuid.safeParse(v).success);
  if (!ids.length) return fail('Selecione pelo menos um recruta.');
  const raw = String(fd.get('group_id') ?? '');
  if (raw !== 'remover' && !uuid.safeParse(raw).success) return fail('Confira os campos destacados.', { group_id: 'Escolha a tropa de destino.' });
  const supabase = createClient();
  const { data, error } = await supabase.rpc('assign_encontristas', { p_ids: ids, p_group: raw === 'remover' ? null : raw });
  if (error) return fail(friendlyError(error));
  revalidatePath('/grupos');
  revalidatePath('/grupos/distribuir');
  revalidatePath('/encontristas');
  const n = Number(data ?? 0);
  return done(raw === 'remover' ? `${n} recruta(s) removido(s) da tropa.` : `${n} recruta(s) atribuído(s) à tropa.`);
}
