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
  name: requiredText('o nome da equipe', 2, 80),
  description: optionalText(1000),
  capacity: z.coerce
    .number({ invalid_type_error: 'Informe o limite de vagas.' })
    .int('Use um número inteiro.')
    .min(1, 'O limite precisa ser pelo menos 1.')
    .max(2000, 'Limite máximo de 2000 vagas.'),
  status: z.enum(['aberta', 'fechada', 'inativa']),
  internal_notes: optionalText(2000),
});

function read(fd: FormData) {
  return schema.safeParse({
    name: fd.get('name'),
    description: fd.get('description') ?? '',
    capacity: fd.get('capacity'),
    status: fd.get('status'),
    internal_notes: fd.get('internal_notes') ?? '',
  });
}

export async function createTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('equipes.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return fail('Cadastre o acampamento antes de criar equipes.');
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('service_teams')
    .insert({ ...parsed.data, camp_id: camp.id, created_by: access.userId })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe uma equipe com este nome.' });
    return fail(friendlyError(error));
  }
  revalidatePath('/equipes');
  redirect(`/equipes/${data.id}?criada=1`);
}

export async function updateTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('equipes.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Equipe inválida.');
  const parsed = read(fd);
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = createClient();
  const { data, error } = await supabase.from('service_teams').update(parsed.data).eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23505') return fail('Confira os campos destacados.', { name: 'Já existe uma equipe com este nome.' });
    const msg = friendlyError(error);
    if (msg.includes('limite')) return fail('Confira os campos destacados.', { capacity: msg });
    return fail(msg);
  }
  if (!data?.length) return fail('Não foi possível salvar. O acampamento pode estar encerrado ou você não tem permissão.');
  revalidatePath(`/equipes/${id.data}`);
  revalidatePath('/equipes');
  redirect(`/equipes/${id.data}`);
}

export async function deleteTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('equipes.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Equipe inválida.');
  const supabase = createClient();
  const { data, error } = await supabase.from('service_teams').delete().eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23503') return fail('A equipe tem inscrições (mesmo canceladas) e não pode ser excluída. Marque-a como inativa.');
    return fail(friendlyError(error));
  }
  if (!data?.length) return fail('Não foi possível excluir a equipe.');
  revalidatePath('/equipes');
  redirect('/equipes');
}

export async function regenerateLink(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('equipes.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Equipe inválida.');
  const supabase = createClient();
  const { data: team } = await supabase.from('service_teams').select('name').eq('id', id.data).maybeSingle();
  if (!team) return fail('Equipe não encontrada.');
  const base =
    team.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'equipe';
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
  const { data, error } = await supabase.from('service_teams').update({ slug: `${base}-${suffix}` }).eq('id', id.data).select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível gerar um novo link.');
  revalidatePath(`/equipes/${id.data}`);
  return done('Novo link gerado. O link anterior deixou de funcionar.');
}

export async function addCoordinator(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('equipes.gerenciar');
  const team = uuid.safeParse(fd.get('team_id'));
  const user = uuid.safeParse(fd.get('user_id'));
  if (!team.success) return fail('Equipe inválida.');
  if (!user.success) return fail('Confira os campos destacados.', { user_id: 'Escolha um usuário.' });
  const supabase = createClient();
  const { error } = await supabase.from('service_team_coordinators').insert({ team_id: team.data, user_id: user.data, created_by: access.userId });
  if (error) {
    if (error.code === '23505') return fail('Este usuário já coordena a equipe.');
    return fail(friendlyError(error));
  }
  revalidatePath(`/equipes/${team.data}`);
  return done('Coordenador adicionado.');
}

export async function removeCoordinator(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('equipes.gerenciar');
  const team = uuid.safeParse(fd.get('team_id'));
  const user = uuid.safeParse(fd.get('user_id'));
  if (!team.success || !user.success) return fail('Dados inválidos.');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('service_team_coordinators')
    .delete()
    .eq('team_id', team.data)
    .eq('user_id', user.data)
    .select('user_id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível remover.');
  revalidatePath(`/equipes/${team.data}`);
  return done('Coordenador removido.');
}
