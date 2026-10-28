'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';
import { birthDate, optionalText, phoneRequired, requiredText, uuid } from '@/lib/validation';

const personSchema = z.object({
  full_name: requiredText('o nome completo', 3, 150),
  phone: phoneRequired,
  birth_date: birthDate,
  shirt_size: z.string().min(1, 'Escolha o tamanho da camiseta.'),
  admin_notes: optionalText(2000),
});

function readExtra(fd: FormData) {
  const extra: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (k.startsWith('extra.') && typeof v === 'string') extra[k.slice(6)] = v.trim();
  });
  return extra;
}

function mapFieldError(msg: string): ActionState {
  if (msg.startsWith('Telefone')) return fail('Confira os campos destacados.', { phone: msg });
  if (msg.startsWith('Data de nascimento')) return fail('Confira os campos destacados.', { birth_date: msg });
  if (msg.startsWith('Escolha um tamanho')) return fail('Confira os campos destacados.', { shirt_size: msg });
  if (msg.startsWith('Informe o nome')) return fail('Confira os campos destacados.', { full_name: msg });
  return fail(msg);
}

export async function staffCreateServidor(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAccess();
  const team = uuid.safeParse(fd.get('team_id'));
  if (!team.success) return fail('Confira os campos destacados.', { team_id: 'Escolha a equipe.' });
  const parsed = personSchema.safeParse({
    full_name: fd.get('full_name'),
    phone: fd.get('phone') ?? '',
    birth_date: fd.get('birth_date') ?? '',
    shirt_size: fd.get('shirt_size') ?? '',
    admin_notes: fd.get('admin_notes') ?? '',
  });
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = createClient();
  const { data, error } = await supabase.rpc('staff_register_servidor', {
    p_team: team.data,
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_birth_date: parsed.data.birth_date,
    p_shirt_size: parsed.data.shirt_size,
    p_extra: readExtra(fd),
    p_admin_notes: parsed.data.admin_notes,
  });
  if (error || !data) return mapFieldError(friendlyError(error));
  revalidatePath('/servidores');
  revalidatePath(`/equipes/${team.data}`);
  redirect(`/servidores/${data}?novo=1`);
}

export async function updateServidor(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAccess();
  const id = uuid.safeParse(fd.get('id'));
  const personId = uuid.safeParse(fd.get('person_id'));
  if (!id.success || !personId.success) return fail('Registro inválido.');
  const parsed = personSchema.safeParse({
    full_name: fd.get('full_name'),
    phone: fd.get('phone') ?? '',
    birth_date: fd.get('birth_date') ?? '',
    shirt_size: fd.get('shirt_size') ?? '',
    admin_notes: fd.get('admin_notes') ?? '',
  });
  if (!parsed.success) return fromZod(parsed.error);

  const camp = await getActiveCamp();
  if (!camp) return fail('Nenhum acampamento ativo.');
  if (!camp.shirt_sizes.includes(parsed.data.shirt_size)) return fail('Confira os campos destacados.', { shirt_size: 'Escolha um tamanho da lista.' });

  // Respostas extras: valida contra a configuração do acampamento.
  const extraIn = readExtra(fd);
  const extra: Record<string, string> = {};
  for (const f of camp.signup_fields) {
    const v = (extraIn[f.key] ?? '').slice(0, 300);
    if (!v) continue;
    if (f.type === 'select' && !f.options.includes(v)) return fail(`Valor inválido no campo “${f.label}”.`);
    extra[f.key] = v;
  }

  const supabase = createClient();
  const { data: p, error: pe } = await supabase
    .from('people')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone, birth_date: parsed.data.birth_date })
    .eq('id', personId.data)
    .select('id');
  if (pe) {
    if (pe.code === '23505') return fail('Já existe outra pessoa com este telefone e data de nascimento neste acampamento.');
    return fail(friendlyError(pe));
  }
  if (!p?.length) return fail('Você não tem permissão para alterar este cadastro ou o acampamento está encerrado.');
  const { data: m, error: me } = await supabase
    .from('service_team_memberships')
    .update({ shirt_size: parsed.data.shirt_size, admin_notes: parsed.data.admin_notes, extra_answers: extra })
    .eq('id', id.data)
    .select('id');
  if (me) return fail(friendlyError(me));
  if (!m?.length) return fail('Você não tem permissão para alterar esta inscrição.');
  revalidatePath(`/servidores/${id.data}`);
  return done('Cadastro salvo.');
}

export async function setServidorStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAccess();
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Registro inválido.');
  const status = fd.get('status') === 'ativa' ? 'ativa' : 'cancelada';
  const reason = String(fd.get('reason') ?? '').slice(0, 500);
  const supabase = createClient();
  const { error } = await supabase.rpc('set_membership_status', { p_id: id.data, p_status: status, p_reason: reason || null });
  if (error) return fail(friendlyError(error));
  revalidatePath(`/servidores/${id.data}`);
  revalidatePath('/servidores');
  return done(status === 'ativa' ? 'Inscrição reativada.' : 'Inscrição cancelada. A vaga foi liberada.');
}

export async function moveServidor(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAccess();
  const id = uuid.safeParse(fd.get('id'));
  const team = uuid.safeParse(fd.get('team_id'));
  if (!id.success) return fail('Registro inválido.');
  if (!team.success) return fail('Confira os campos destacados.', { team_id: 'Escolha a nova equipe.' });
  const supabase = createClient();
  const { error } = await supabase.rpc('move_servidor', { p_id: id.data, p_new_team: team.data });
  if (error) return fail(friendlyError(error));
  revalidatePath(`/servidores/${id.data}`);
  revalidatePath('/servidores');
  return done('Soldado/servo transferido de equipe.');
}
