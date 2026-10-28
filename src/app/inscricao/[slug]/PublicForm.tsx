'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DateInput } from '@/components/ui/date-input';
import { ActionForm, Field, SubmitButton, useFieldError } from '@/components/ui/form';
import { Checkbox, Input, Select } from '@/components/ui/input';
import type { ActionState } from '@/lib/action';
import { publicRegister } from './actions';

type SignupField = { key: string; label: string; type: 'text' | 'select'; required: boolean; options: string[] };

function ConsentBox({ notice }: { notice: string }) {
  const error = useFieldError('consent');
  return (
    <div>
      <div className="rounded-md border border-pedra-200 bg-pedra p-3 text-xs leading-relaxed text-pedra-600">{notice}</div>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
        <Checkbox id="f-consent" name="consent" aria-invalid={error ? true : undefined} className="mt-0.5" />
        <span>Li e concordo com o uso dos meus dados para a organização do acampamento.</span>
      </label>
      {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
    </div>
  );
}

export function PublicForm({
  slug,
  teamName,
  sizes,
  fields,
  privacyNotice,
}: {
  slug: string;
  teamName: string;
  sizes: string[];
  fields: SignupField[];
  privacyNotice: string;
}) {
  const [doneName, setDoneName] = React.useState<string | null>(null);

  if (doneName !== null) {
    return (
      <div className="py-4 text-center" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-ok" aria-hidden />
        <h2 className="mt-3 text-xl">Inscrição recebida{doneName ? `, ${doneName}` : ''}!</h2>
        <p className="mt-2 text-sm text-pedra-600">
          Você está inscrito na equipe <strong>{teamName}</strong>. A coordenação da equipe vai entrar em contato pelo telefone informado.
        </p>
        <p className="mt-3 text-xs text-pedra-500">A inscrição não confirma pagamento. Se houver taxa, a coordenação vai orientar.</p>
      </div>
    );
  }

  return (
    <ActionForm
      action={publicRegister}
      showSuccessToast={false}
      onSuccess={(s: ActionState) => setDoneName(String(s.data?.name ?? ''))}
      className="space-y-4"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="website">Não preencha</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Field label="Nome completo" name="full_name" required>
        <Input autoComplete="name" autoCapitalize="words" />
      </Field>
      <Field label="Telefone (WhatsApp) com DDD" name="phone" required>
        <Input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 98888-7777" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data de nascimento" name="birth_date" required>
          <DateInput autoComplete="bday" />
        </Field>
        <Field label="Tamanho da camiseta" name="shirt_size" required>
          <Select defaultValue="">
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
      </div>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} name={`extra.${f.key}`} required={f.required}>
          {f.type === 'select' ? (
            <Select defaultValue="">
              <option value="">Selecione</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input maxLength={300} />
          )}
        </Field>
      ))}
      <ConsentBox notice={privacyNotice} />
      <SubmitButton size="lg" className="w-full" pendingText="Enviando…">
        Enviar inscrição
      </SubmitButton>
    </ActionForm>
  );
}
