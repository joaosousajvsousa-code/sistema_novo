'use client';

import * as React from 'react';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { ActionForm, Field, FormActions, SubmitButton, useFieldError } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/ui/layout';
import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/cn';
import { createEncontrista, updateEncontrista, updateHealth } from './actions';

export type EncontristaData = {
  id: string;
  person_id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  shirt_size: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relationship: string | null;
  form_notes: string | null;
  admin_notes: string | null;
};

export type HealthData = {
  allergies_status: string;
  allergies: string | null;
  medications_status: string;
  medications: string | null;
  health_notes: string | null;
};

function HealthItem({ name, label, statusValue, textValue }: { name: 'allergies' | 'medications'; label: string; statusValue?: string; textValue?: string | null }) {
  const [status, setStatus] = React.useState(statusValue ?? 'nao_informado');
  const error = useFieldError(name);
  const options = [
    { v: 'nao_informado', l: 'Não informado' },
    { v: 'nao_possui', l: 'Não possui' },
    { v: 'possui', l: 'Possui' },
  ];
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1.5 text-sm font-bold text-pedra-700">{label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-pedra-100 p-1" role="radiogroup">
        {options.map((o) => (
          <label
            key={o.v}
            className={cn(
              'flex h-10 cursor-pointer items-center justify-center rounded text-sm font-bold',
              status === o.v ? 'bg-white text-manto shadow-[0_1px_2px_rgba(21,32,46,0.12)]' : 'text-pedra-600',
            )}
          >
            <input type="radio" className="sr-only" name={`${name}_status`} value={o.v} checked={status === o.v} onChange={() => setStatus(o.v)} />
            {o.l}
          </label>
        ))}
      </div>
      {status === 'possui' ? (
        <div className="mt-2">
          <label htmlFor={`f-${name}`} className="sr-only">
            Descreva
          </label>
          <Textarea id={`f-${name}`} name={name} defaultValue={textValue ?? ''} placeholder="Descreva como está na ficha" aria-invalid={error ? true : undefined} />
          {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
        </div>
      ) : null}
      {status === 'nao_informado' ? <p className="mt-1 text-xs text-pedra-500">Use quando a ficha estiver em branco. Não significa que a pessoa não tem.</p> : null}
    </fieldset>
  );
}

export function HealthFields({ data }: { data?: HealthData | null }) {
  return (
    <>
      <HealthItem name="allergies" label="Alergias" statusValue={data?.allergies_status} textValue={data?.allergies} />
      <HealthItem name="medications" label="Medicamentos em uso" statusValue={data?.medications_status} textValue={data?.medications} />
      <Field label="Outras observações de saúde" name="health_notes" className="sm:col-span-2">
        <Textarea defaultValue={data?.health_notes ?? ''} />
      </Field>
    </>
  );
}

function PersonSections({ sizes, data }: { sizes: string[]; data?: EncontristaData }) {
  return (
    <>
      <FormSection title="Dados pessoais">
        <Field label="Nome completo" name="full_name" required className="sm:col-span-2">
          <Input defaultValue={data?.full_name ?? ''} autoComplete="off" autoCapitalize="words" />
        </Field>
        <Field label="Data de nascimento" name="birth_date" required>
          <DateInput defaultValue={data?.birth_date ?? ''} />
        </Field>
        <Field label="Telefone" name="phone" hint="Com DDD. Deixe em branco se não constar na ficha.">
          <Input type="tel" inputMode="tel" defaultValue={formatPhone(data?.phone)} autoComplete="off" />
        </Field>
        <Field label="Tamanho da camiseta" name="shirt_size">
          <Select defaultValue={data?.shirt_size ?? ''}>
            <option value="">Não informado</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>
      <FormSection title="Contato de emergência">
        <Field label="Nome" name="emergency_name">
          <Input defaultValue={data?.emergency_name ?? ''} autoComplete="off" />
        </Field>
        <Field label="Telefone" name="emergency_phone">
          <Input type="tel" inputMode="tel" defaultValue={formatPhone(data?.emergency_phone)} autoComplete="off" />
        </Field>
        <Field label="Parentesco ou relação" name="emergency_relationship">
          <Input defaultValue={data?.emergency_relationship ?? ''} placeholder="Ex.: mãe, tio, amigo" />
        </Field>
      </FormSection>
    </>
  );
}

function NotesSection({ data }: { data?: EncontristaData }) {
  return (
    <FormSection title="Observações">
      <Field label="Outras observações da ficha" name="form_notes" className="sm:col-span-2">
        <Textarea defaultValue={data?.form_notes ?? ''} />
      </Field>
      <Field label="Observações administrativas" name="admin_notes" hint="Internas da coordenação." className="sm:col-span-2">
        <Textarea defaultValue={data?.admin_notes ?? ''} />
      </Field>
    </FormSection>
  );
}

export function NewEncontristaForm({ sizes }: { sizes: string[] }) {
  return (
    <ActionForm action={createEncontrista} className="space-y-6">
      <PersonSections sizes={sizes} />
      <FormSection title="Saúde" description="Transcreva exatamente o que está na ficha física. Visível só para quem tem permissão.">
        <HealthFields />
      </FormSection>
      <NotesSection />
      <FormActions>
        <Link href="/encontristas" className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        <SubmitButton variant="secondary" name="next" value="another">
          Salvar e cadastrar outro
        </SubmitButton>
        <SubmitButton name="next" value="view">
          Salvar ficha
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function EditEncontristaForm({ data, sizes }: { data: EncontristaData; sizes: string[] }) {
  return (
    <ActionForm action={updateEncontrista} className="space-y-6">
      <input type="hidden" name="id" value={data.id} />
      <input type="hidden" name="person_id" value={data.person_id} />
      <PersonSections sizes={sizes} data={data} />
      <NotesSection data={data} />
      <FormActions>
        <Link href={`/encontristas/${data.id}`} className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        <SubmitButton>Salvar alterações</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function EditHealthForm({ id, data }: { id: string; data: HealthData }) {
  return (
    <ActionForm action={updateHealth} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <HealthFields data={data} />
      </div>
      <FormActions>
        <SubmitButton>Salvar saúde</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
