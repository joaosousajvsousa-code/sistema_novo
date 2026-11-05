'use client';

import * as React from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DateInput } from '@/components/ui/date-input';
import { ActionForm, Field, SubmitButton, useFieldError } from '@/components/ui/form';
import { Checkbox, Input, Select } from '@/components/ui/input';
import type { ActionState } from '@/lib/action';
import { publicRegister } from './actions';

type SignupField = { key: string; label: string; type: 'text' | 'select'; required: boolean; options: string[] };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 flex w-full items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-manto text-sm font-bold text-cirio">{n}</span>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-manto">{title}</span>
        <span aria-hidden className="h-px flex-1 bg-pedra-200" />
      </legend>
      {children}
    </fieldset>
  );
}

// Tamanhos em botões grandes (mais fácil no celular do que uma lista).
function SizePicker({ sizes }: { sizes: string[] }) {
  const error = useFieldError('shirt_size');
  const [value, setValue] = React.useState('');
  return (
    <div>
      <p id="f-shirt_size-label" className="mb-2 block text-sm font-bold text-pedra-700">
        Tamanho da camiseta<span className="ml-0.5 text-erro" aria-hidden> *</span>
      </p>
      <div role="radiogroup" aria-labelledby="f-shirt_size-label" aria-invalid={error ? true : undefined} className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {sizes.map((s) => {
          const on = value === s;
          return (
            <label
              key={s}
              className={cn(
                'relative flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 text-sm font-bold transition',
                on ? 'border-manto bg-manto text-white shadow-[0_8px_18px_-10px_rgba(61,74,42,0.9)]' : 'border-pedra-200 bg-white text-pedra-700 hover:border-manto/50',
                error && !on && 'border-erro/40',
              )}
            >
              <input type="radio" name="shirt_size" value={s} checked={on} onChange={() => setValue(s)} className="sr-only" />
              {s}
              {on ? <Check className="absolute right-1 top-1 h-3 w-3 text-cirio" strokeWidth={3} aria-hidden /> : null}
            </label>
          );
        })}
      </div>
      {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
    </div>
  );
}

function ConsentBox({ notice }: { notice: string }) {
  const error = useFieldError('consent');
  return (
    <div>
      <div className="flex gap-3 rounded-xl border border-pedra-200 bg-pedra p-4 text-xs leading-relaxed text-pedra-600">
        <ShieldCheck className="h-5 w-5 shrink-0 text-manto" aria-hidden />
        <span>{notice}</span>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-pedra-200 p-3 text-sm hover:bg-pedra/60">
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
      <div className="py-6 text-center" role="status">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-manto text-cirio shadow-[0_14px_30px_-12px_rgba(61,74,42,0.9)] ring-8 ring-manto-50">
          <Check className="h-10 w-10" strokeWidth={3} aria-hidden />
        </span>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-cirio-700">Alistamento recebido</p>
        <h2 className="mt-1 text-2xl">{doneName ? `Bem-vindo(a), ${doneName}!` : 'Bem-vindo(a)!'}</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-pedra-600">
          Você está inscrito na equipe <strong className="text-pedra-900">{teamName}</strong>. A coordenação vai entrar em contato pelo WhatsApp informado.
        </p>
        <p className="mx-auto mt-5 max-w-sm rounded-xl bg-pedra px-4 py-3 text-xs text-pedra-500">A inscrição não confirma pagamento. Se houver taxa, a coordenação vai orientar.</p>
      </div>
    );
  }

  return (
    <ActionForm
      action={publicRegister}
      showSuccessToast={false}
      onSuccess={(s: ActionState) => setDoneName(String(s.data?.name ?? ''))}
      className="space-y-8"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="website">Não preencha</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Step n={1} title="Seus dados">
        <Field label="Nome completo" name="full_name" required>
          <Input autoComplete="name" autoCapitalize="words" placeholder="Como está no documento" className="h-12 text-base" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp com DDD" name="phone" required>
            <Input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 98888-7777" className="h-12 text-base" />
          </Field>
          <Field label="Data de nascimento" name="birth_date" required>
            <DateInput autoComplete="bday" className="h-12 text-base" />
          </Field>
        </div>
      </Step>
      <Step n={2} title="Camiseta">
        <SizePicker sizes={sizes} />
      </Step>
      {fields.length ? (
        <Step n={3} title="Mais informações">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} name={`extra.${f.key}`} required={f.required}>
              {f.type === 'select' ? (
                <Select defaultValue="" className="h-12 text-base">
                  <option value="">Selecione</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input maxLength={300} className="h-12 text-base" />
              )}
            </Field>
          ))}
        </Step>
      ) : null}
      <Step n={fields.length ? 4 : 3} title="Confirmação">
        <ConsentBox notice={privacyNotice} />
      </Step>
      <SubmitButton size="lg" className="h-14 w-full rounded-xl bg-cirio text-base text-manto-800 shadow-[0_14px_30px_-14px_rgba(200,161,101,0.9)] hover:bg-[#D4B37E]" pendingText="Enviando…">
        Enviar inscrição <ArrowRight className="h-5 w-5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}
