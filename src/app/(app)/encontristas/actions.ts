'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { appErrorCode, friendlyError } from '@/lib/errors';
import { birthDate, optionalText, phoneOptional, requiredText, uuid } from '@/lib/validation';

const healthStatus = z.enum(['nao_informado', 'nao_possui', 'possui']).catch('nao_informado');

const personSchema = z.object({
  full_name: requiredText('o nome completo', 3, 150),
  phone: phoneOptional,
  birth_date: birthDate,
  shirt_size: optionalText(20),
  emergency_name: optionalText(150),
  emergency_phone: phoneOptional,
  emergency_relationship: optionalText(60),
  form_notes: optionalText(2000),
  admin_notes: optionalText(2000),
});

const healthSchema = z
  .object({
    allergies_status: healthStatus,
    allergies: optionalText(1000),
    medications_status: healthStatus,
    medications: optionalText(1000),
    health_notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.allergies_status === 'possui' && !v.allergies) ctx.addIssue({ code: 'custom', path: ['allergies'], message: 'Descreva as alergias.' });
    if (v.medications_status === 'possui' && !v.medications)
      ctx.addIssue({ code: 'custom', path: ['medications'], message: 'Descreva os medicamentos.' });
  });

function readPerson(fd: FormData) {
  return personSchema.safeParse({
    full_name: fd.get('full_name'),
    phone: fd.get('phone') ?? '',
    birth_date: fd.get('birth_date') ?? '',
    shirt_size: fd.get('shirt_size') ?? '',
    emergency_name: fd.get('emergency_name') ?? '',
    emergency_phone: fd.get('emergency_phone') ?? '',
    emergency_relationship: fd.get('emergency_relationship') ?? '',
    form_notes: fd.get('form_notes') ?? '',
    admin_notes: fd.get('admin_notes') ?? '',
  });
}

function readHealth(fd: FormData) {
  return healthSchema.safeParse({
    allergies_status: fd.get('allergies_status'),
    allergies: fd.get('allergies') ?? '',
    medications_status: fd.get('medications_status'),
    medications: fd.get('medications') ?? '',
    health_notes: fd.get('health_notes') ?? '',
  });
}

export async function createEncontrista(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('encontristas.editar');
  const p = readPerson(fd);
  if (!p.success) return fromZod(p.error);
  const h = readHealth(fd);
  if (!h.success) return fromZod(h.error);
  const camp = await getActiveCamp();
  if (p.data.shirt_size && camp && !camp.shirt_sizes.includes(p.data.shirt_size)) {
    return fail('Confira os campos destacados.', { shirt_size: 'Escolha um tamanho da lista.' });
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_encontrista', {
    p_full_name: p.data.full_name,
    p_phone: p.data.phone,
    p_birth_date: p.data.birth_date,
    p_shirt_size: p.data.shirt_size,
    p_emergency_name: p.data.emergency_name,
    p_emergency_phone: p.data.emergency_phone,
    p_emergency_relationship: p.data.emergency_relationship,
    p_allergies_status: h.data.allergies_status,
    p_allergies: h.data.allergies,
    p_medications_status: h.data.medications_status,
    p_medications: h.data.medications,
    p_health_notes: h.data.health_notes,
    p_form_notes: p.data.form_notes,
    p_admin_notes: p.data.admin_notes,
  });
  if (error || !data) {
    const code = appErrorCode(error);
    const msg = friendlyError(error);
    if (code === 'TELEFONE_INVALIDO') return fail('Confira os campos destacados.', { phone: msg });
    if (code === 'TELEFONE_EMERGENCIA_INVALIDO') return fail('Confira os campos destacados.', { emergency_phone: msg });
    if (code === 'DATA_NASCIMENTO_INVALIDA') return fail('Confira os campos destacados.', { birth_date: msg });
    return fail(msg);
  }
  revalidatePath('/encontristas');
  if (fd.get('next') === 'another') redirect(`/encontristas/novo?salvo=${Date.now()}`);
  redirect(`/encontristas/${data}?novo=1`);
}

export async function updateEncontrista(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('encontristas.editar');
  const id = uuid.safeParse(fd.get('id'));
  const personId = uuid.safeParse(fd.get('person_id'));
  if (!id.success || !personId.success) return fail('Registro inválido.');
  const p = readPerson(fd);
  if (!p.success) return fromZod(p.error);
  const camp = await getActiveCamp();
  if (p.data.shirt_size && camp && !camp.shirt_sizes.includes(p.data.shirt_size)) {
    return fail('Confira os campos destacados.', { shirt_size: 'Escolha um tamanho da lista.' });
  }
  const supabase = createClient();
  const { data: pr, error: pe } = await supabase
    .from('people')
    .update({ full_name: p.data.full_name, phone: p.data.phone, birth_date: p.data.birth_date })
    .eq('id', personId.data)
    .select('id');
  if (pe) {
    if (pe.code === '23505') return fail('Já existe outra pessoa com este telefone e data de nascimento neste acampamento.');
    return fail(friendlyError(pe));
  }
  if (!pr?.length) return fail('Não foi possível salvar. O acampamento pode estar encerrado ou você não tem permissão.');
  const { data: er, error: ee } = await supabase
    .from('encontristas')
    .update({
      shirt_size: p.data.shirt_size,
      emergency_name: p.data.emergency_name,
      emergency_phone: p.data.emergency_phone,
      emergency_relationship: p.data.emergency_relationship,
      form_notes: p.data.form_notes,
      admin_notes: p.data.admin_notes,
    })
    .eq('id', id.data)
    .select('id');
  if (ee) return fail(friendlyError(ee));
  if (!er?.length) return fail('Não foi possível salvar a ficha.');
  revalidatePath(`/encontristas/${id.data}`);
  redirect(`/encontristas/${id.data}?salvo=1`);
}

export async function updateHealth(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('encontristas.editar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Registro inválido.');
  const h = readHealth(fd);
  if (!h.success) return fromZod(h.error);
  const supabase = createClient();
  const { error } = await supabase.rpc('update_encontrista_health', {
    p_id: id.data,
    p_allergies_status: h.data.allergies_status,
    p_allergies: h.data.allergies,
    p_medications_status: h.data.medications_status,
    p_medications: h.data.medications,
    p_health_notes: h.data.health_notes,
  });
  if (error) return fail(friendlyError(error));
  revalidatePath(`/encontristas/${id.data}`);
  return done('Informações de saúde salvas.');
}

export async function setEncontristaStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('encontristas.editar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Registro inválido.');
  const status = fd.get('status') === 'ativo' ? 'ativo' : 'cancelado';
  const supabase = createClient();
  const { data, error } = await supabase.from('encontristas').update({ status }).eq('id', id.data).select('id');
  if (error) {
    if (error.code === '23505') return fail('Já existe outra ficha ativa para esta pessoa.');
    return fail(friendlyError(error));
  }
  if (!data?.length) return fail('Não foi possível alterar a situação da ficha.');
  revalidatePath(`/encontristas/${id.data}`);
  revalidatePath('/encontristas');
  return done(status === 'ativo' ? 'Ficha reativada.' : 'Ficha cancelada. Ela sai das contagens e relatórios.');
}

export async function setEncontristaGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('grupos.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Registro inválido.');
  const raw = String(fd.get('group_id') ?? '');
  const group = raw === '' ? null : uuid.safeParse(raw);
  if (group && !group.success) return fail('Grupo inválido.');
  const supabase = createClient();
  const { error } = await supabase.rpc('assign_encontristas', { p_ids: [id.data], p_group: group ? group.data : null });
  if (error) return fail(friendlyError(error));
  revalidatePath(`/encontristas/${id.data}`);
  revalidatePath('/grupos');
  return done(group ? 'Grupo atualizado.' : 'Encontrista removido do grupo.');
}
