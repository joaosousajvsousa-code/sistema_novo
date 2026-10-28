'use client';

import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/ui/layout';
import { formatPhone } from '@/lib/format';
import { staffCreateServidor, updateServidor } from './actions';

export type SignupField = { key: string; label: string; type: 'text' | 'select'; required: boolean; options: string[] };

export type ServidorData = {
  id: string;
  person_id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  shirt_size: string | null;
  admin_notes: string | null;
  extra_answers: Record<string, string>;
};

export function ExtraFields({ fields, values, requireMarks = true }: { fields: SignupField[]; values?: Record<string, string>; requireMarks?: boolean }) {
  return (
    <>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} name={`extra.${f.key}`} required={requireMarks && f.required}>
          {f.type === 'select' ? (
            <Select defaultValue={values?.[f.key] ?? ''}>
              <option value="">Selecione</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input defaultValue={values?.[f.key] ?? ''} maxLength={300} />
          )}
        </Field>
      ))}
    </>
  );
}

export function PersonFields({ sizes, data }: { sizes: string[]; data?: Partial<ServidorData> }) {
  return (
    <>
      <Field label="Nome completo" name="full_name" required className="sm:col-span-2">
        <Input defaultValue={data?.full_name ?? ''} autoComplete="off" autoCapitalize="words" />
      </Field>
      <Field label="Telefone com DDD" name="phone" required>
        <Input type="tel" inputMode="tel" defaultValue={formatPhone(data?.phone)} placeholder="(11) 98888-7777" autoComplete="off" />
      </Field>
      <Field label="Data de nascimento" name="birth_date" required>
        <DateInput defaultValue={data?.birth_date ?? ''} />
      </Field>
      <Field label="Tamanho da camiseta" name="shirt_size" required>
        <Select defaultValue={data?.shirt_size ?? ''}>
          <option value="" disabled>
            Selecione
          </option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function NewServidorForm({
  teams,
  defaultTeam,
  sizes,
  fields,
}: {
  teams: { id: string; name: string; available: number }[];
  defaultTeam?: string;
  sizes: string[];
  fields: SignupField[];
}) {
  return (
    <ActionForm action={staffCreateServidor} className="space-y-6">
      <FormSection title="Equipe">
        <Field label="Equipe de serviço" name="team_id" required className="sm:col-span-2">
          <Select defaultValue={defaultTeam ?? ''}>
            <option value="" disabled>
              Selecione
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.available <= 0}>
                {t.name} — {t.available > 0 ? `${t.available} vaga(s)` : 'esgotada'}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>
      <FormSection title="Dados do soldado/servo">
        <PersonFields sizes={sizes} />
      </FormSection>
      {fields.length ? (
        <FormSection title="Informações adicionais">
          <ExtraFields fields={fields} />
        </FormSection>
      ) : null}
      <FormSection title="Observações" description="Internas, não aparecem para o soldado/servo.">
        <Field label="Observações administrativas" name="admin_notes" className="sm:col-span-2">
          <Textarea />
        </Field>
      </FormSection>
      <FormActions>
        <Link href="/servidores" className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        <SubmitButton>Cadastrar soldado/servo</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function EditServidorForm({ data, sizes, fields }: { data: ServidorData; sizes: string[]; fields: SignupField[] }) {
  return (
    <ActionForm action={updateServidor} className="space-y-6">
      <input type="hidden" name="id" value={data.id} />
      <input type="hidden" name="person_id" value={data.person_id} />
      <FormSection title="Dados pessoais">
        <PersonFields sizes={sizes} data={data} />
      </FormSection>
      {fields.length ? (
        <FormSection title="Informações adicionais">
          <ExtraFields fields={fields} values={data.extra_answers} requireMarks={false} />
        </FormSection>
      ) : null}
      <FormSection title="Observações">
        <Field label="Observações administrativas" name="admin_notes" className="sm:col-span-2">
          <Textarea defaultValue={data.admin_notes ?? ''} />
        </Field>
      </FormSection>
      <FormActions>
        <SubmitButton>Salvar cadastro</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
