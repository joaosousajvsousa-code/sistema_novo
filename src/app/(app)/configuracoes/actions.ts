'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';
import { optionalDate, optionalText, requiredText } from '@/lib/validation';

const STATUSES = ['planejamento', 'inscricoes_abertas', 'em_andamento', 'encerrado'] as const;

const fieldSchema = z.object({
  label: z.string().trim().min(1, 'Dê um nome ao campo.').max(60, 'Nome do campo muito longo.'),
  type: z.enum(['text', 'select']),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

const schema = z
  .object({
    name: requiredText('o nome do acampamento', 2, 120),
    description: optionalText(2000),
    start_date: optionalDate,
    end_date: optionalDate,
    location: optionalText(200),
    responsaveis: optionalText(500),
    status: z.enum(STATUSES, { errorMap: () => ({ message: 'Escolha um status.' }) }),
    shirt_sizes: z
      .string()
      .transform((v) =>
        Array.from(
          new Set(
            v
              .split(/[,;\n]/)
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
          ),
        ),
      )
      .pipe(
        z
          .array(z.string().max(20, 'Cada tamanho pode ter até 20 caracteres.'))
          .min(1, 'Informe pelo menos um tamanho.')
          .max(30, 'Use no máximo 30 tamanhos.'),
      ),
    privacy_notice: optionalText(3000),
    operational_notes: optionalText(3000),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: 'O término não pode ser antes do início.',
    path: ['end_date'],
  });

function slugKey(label: string) {
  return (
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'campo'
  );
}

function parseSignupFields(raw: FormDataEntryValue | null) {
  let json: unknown = [];
  try {
    json = JSON.parse(String(raw ?? '[]'));
  } catch {
    return { error: 'Os campos adicionais estão em formato inválido.' } as const;
  }
  const parsed = z.array(fieldSchema).max(10, 'Use no máximo 10 campos adicionais.').safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Campos adicionais inválidos.' } as const;
  const used = new Set<string>();
  const fields = [];
  for (const f of parsed.data) {
    if (f.type === 'select' && f.options.length < 2) return { error: `O campo “${f.label}” precisa de pelo menos duas opções.` } as const;
    let key = slugKey(f.label);
    let n = 2;
    while (used.has(key)) key = `${slugKey(f.label)}_${n++}`;
    used.add(key);
    fields.push({ key, label: f.label, type: f.type, required: f.required, options: f.type === 'select' ? f.options : [] });
  }
  return { fields } as const;
}

export async function saveCamp(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('acampamento.gerenciar');
  const parsed = schema.safeParse({
    name: fd.get('name'),
    description: fd.get('description') ?? '',
    start_date: fd.get('start_date') ?? '',
    end_date: fd.get('end_date') ?? '',
    location: fd.get('location') ?? '',
    responsaveis: fd.get('responsaveis') ?? '',
    status: fd.get('status'),
    shirt_sizes: fd.get('shirt_sizes') ?? '',
    privacy_notice: fd.get('privacy_notice') ?? '',
    operational_notes: fd.get('operational_notes') ?? '',
  });
  if (!parsed.success) return fromZod(parsed.error);
  const sf = parseSignupFields(fd.get('signup_fields'));
  if ('error' in sf) return fail(sf.error ?? 'Campos adicionais inválidos.');

  const supabase = createClient();
  const id = String(fd.get('id') ?? '');
  const payload = { ...parsed.data, signup_fields: sf.fields };

  if (!id) return fail('Configurações não encontradas. Recarregue a página.');
  const { data, error } = await supabase.from('camps').update(payload).eq('id', id).eq('is_active', true).select('id');
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail('Não foi possível salvar. Você não tem permissão ou a página está desatualizada.');
  revalidatePath('/', 'layout');
  return done('Configurações salvas.');
}
