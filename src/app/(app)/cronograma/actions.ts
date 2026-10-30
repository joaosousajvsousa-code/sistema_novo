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
import { localToIso } from '@/lib/schedule';
import { parseSchedule } from '@/lib/schedule-parse';

const time = (label: string) =>
  z
    .string({ required_error: `Informe ${label}.` })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Informe ${label} no formato HH:MM.`);

const schema = z.object({
  title: requiredText('o nome do momento', 2, 120),
  date: z
    .string()
    .refine((v) => v !== 'invalida', 'Data inválida. Use DD/MM/AAAA.')
    .refine((v) => v === 'invalida' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Informe o dia.'),
  start: time('o horário de início'),
  end: time('o horário de término'),
  location: optionalText(120),
  responsible: optionalText(120),
  description: optionalText(1000),
  notes: optionalText(1000),
});

function read(fd: FormData) {
  return schema.safeParse({
    title: fd.get('title'),
    date: fd.get('date') ?? '',
    start: fd.get('start') ?? '',
    end: fd.get('end') ?? '',
    location: fd.get('location') ?? '',
    responsible: fd.get('responsible') ?? '',
    description: fd.get('description') ?? '',
    notes: fd.get('notes') ?? '',
  });
}

function toTimes(date: string, start: string, end: string) {
  const s = localToIso(date, start);
  let e = localToIso(date, end);
  // Término menor que o início: momento que vira a noite (ex.: 23:00 às 01:00).
  if (new Date(e) <= new Date(s)) e = new Date(new Date(e).getTime() + 24 * 3600_000).toISOString();
  return { s, e };
}

export async function createItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('programacao.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return fail('Acampamento não encontrado.');
  const p = read(fd);
  if (!p.success) return fromZod(p.error);
  const { s, e } = toTimes(p.data.date, p.data.start, p.data.end);
  const supabase = createClient();
  const { error } = await supabase.from('schedule_items').insert({
    camp_id: camp.id,
    title: p.data.title,
    location: p.data.location,
    responsible: p.data.responsible,
    description: p.data.description,
    notes: p.data.notes,
    planned_start: s,
    planned_end: e,
    original_start: s,
    original_end: e,
    created_by: access.userId,
    updated_by: access.userId,
  });
  if (error) return fail(friendlyError(error));
  revalidatePath('/cronograma');
  if (fd.get('next') === 'another') redirect(`/cronograma/nova?salvo=${Date.now()}&dia=${p.data.date}&inicio=${p.data.end}`);
  redirect('/cronograma');
}

export async function updateItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('programacao.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Momento inválido.');
  const p = read(fd);
  if (!p.success) return fromZod(p.error);
  const { s, e } = toTimes(p.data.date, p.data.start, p.data.end);
  const supabase = createClient();
  // Editar pelo formulário redefine o horário oficial (original e previsto).
  const { data, error } = await supabase
    .from('schedule_items')
    .update({
      title: p.data.title,
      location: p.data.location,
      responsible: p.data.responsible,
      description: p.data.description,
      notes: p.data.notes,
      planned_start: s,
      planned_end: e,
      original_start: s,
      original_end: e,
      updated_by: access.userId,
    })
    .eq('id', id.data)
    .select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível salvar o momento.');
  revalidatePath('/cronograma');
  redirect('/cronograma');
}

export async function deleteItem(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('programacao.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Momento inválido.');
  const supabase = createClient();
  const { data, error } = await supabase.from('schedule_items').delete().eq('id', id.data).select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Só é possível excluir momentos ainda agendados. Para os outros, use “Cancelar”.');
  revalidatePath('/cronograma');
  redirect('/cronograma');
}

const STATUS = ['agendada', 'em_andamento', 'concluida', 'cancelada'] as const;
const STATUS_MSG: Record<(typeof STATUS)[number], string> = {
  em_andamento: 'Momento iniciado.',
  concluida: 'Momento concluído.',
  cancelada: 'Momento cancelado.',
  agendada: 'Momento reaberto.',
};

export async function setStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('programacao.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  const status = z.enum(STATUS).safeParse(fd.get('status'));
  if (!id.success || !status.success) return fail('Ação inválida.');
  const supabase = createClient();
  const { error } = await supabase.rpc('set_schedule_status', { p_id: id.data, p_status: status.data, p_note: null });
  if (error) return fail(friendlyError(error));
  revalidatePath('/cronograma');
  
  return done(STATUS_MSG[status.data]);
}

export async function shiftAfter(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('programacao.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  const minutes = z.coerce.number().int().min(-720).max(720).safeParse(fd.get('minutes'));
  if (!id.success) return fail('Momento inválido.');
  if (!minutes.success || minutes.data === 0) return fail('Confira os campos destacados.', { minutes: 'Informe os minutos (ex.: 15).' });
  const supabase = createClient();
  const { data, error } = await supabase.rpc('shift_schedule_after', { p_id: id.data, p_minutes: minutes.data });
  if (error) return fail(friendlyError(error));
  revalidatePath('/cronograma');
  
  return done(`${data ?? 0} momento(s) seguinte(s) ${minutes.data > 0 ? 'empurrado(s)' : 'adiantado(s)'} em ${Math.abs(minutes.data)} min.`);
}

export async function resetToOriginal(_: ActionState, _fd: FormData): Promise<ActionState> {
  await requirePerm('programacao.gerenciar');
  const supabase = createClient();
  const { data, error } = await supabase.rpc('reset_schedule_to_original');
  if (error) return fail(friendlyError(error));
  revalidatePath('/cronograma');
  return done(`${data ?? 0} momento(s) voltaram ao horário original.`);
}

export async function pasteSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('programacao.gerenciar');
  const camp = await getActiveCamp();
  if (!camp) return fail('Acampamento não encontrado.');
  const date = String(fd.get('date') ?? '');
  if (date === 'invalida') return fail('Confira os campos destacados.', { date: 'Data inválida. Use DD/MM/AAAA.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Confira os campos destacados.', { date: 'Informe o dia.' });
  const text = String(fd.get('text') ?? '').slice(0, 20000);
  const { items, errors } = parseSchedule(text);
  if (errors.length) return fail(`Corrija a linha ${errors[0].line || ''}: ${errors[0].message}.`.replace('linha :', 'lista:'), { text: 'Há linhas que não foram entendidas.' });
  if (!items.length) return fail('Confira os campos destacados.', { text: 'Cole pelo menos um momento.' });

  const base = new Date(localToIso(date, '00:00')).getTime();
  const rows = items.map((i, idx) => {
    const s = new Date(base + i.startMin * 60_000).toISOString();
    const e = new Date(base + i.endMin * 60_000).toISOString();
    return {
      camp_id: camp.id,
      title: i.title,
      location: i.location,
      responsible: i.responsible,
      planned_start: s,
      planned_end: e,
      original_start: s,
      original_end: e,
      sort_order: idx,
      created_by: access.userId,
      updated_by: access.userId,
    };
  });
  const supabase = createClient();
  const { error } = await supabase.from('schedule_items').insert(rows);
  if (error) return fail(friendlyError(error));
  revalidatePath('/cronograma');
  redirect(`/cronograma?colados=${rows.length}`);
}
