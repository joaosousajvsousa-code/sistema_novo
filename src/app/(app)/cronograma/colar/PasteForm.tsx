'use client';

import * as React from 'react';
import Link from 'next/link';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Textarea } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { minToLabel, parseSchedule } from '@/lib/schedule-parse';
import { pasteSchedule } from '../actions';

const EXAMPLE = `07:00 Despertar
07:30 - 08:00 Café da manhã | Refeitório | Equipe Cozinha
08:15 Oração da manhã | Capela
09:00 - 10:30 Primeira palestra | Auditório
12:00 Almoço | Refeitório`;

export function PasteForm({ defaultDate }: { defaultDate: string }) {
  const [text, setText] = React.useState('');
  const parsed = React.useMemo(() => parseSchedule(text), [text]);

  return (
    <ActionForm action={pasteSchedule} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <Field label="Dia" name="date" required>
          <DateInput defaultValue={defaultDate} />
        </Field>
        <div className="text-xs text-pedra-500 sm:pt-7">
          Cole um dia por vez. Horários depois da meia-noite vão para o dia seguinte sozinhos.
        </div>
      </div>
      <Field
        label="Cronograma do dia"
        name="text"
        required
        hint={
          <>
            Uma linha por momento: <strong>horário</strong> e <strong>nome</strong>. Término, local e responsável são opcionais (local e responsável
            separados por <strong>|</strong>).
          </>
        }
      >
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} className="font-sans" />
      </Field>

      {text.trim() ? (
        <section aria-label="Prévia" className="rounded-md border border-pedra-200">
          <p className="border-b border-pedra-200 px-3 py-2 text-sm font-bold">
            Prévia: {parsed.items.length} momento(s){parsed.errors.length ? ` · ${parsed.errors.length} linha(s) com problema` : ''}
          </p>
          <ol className="max-h-80 divide-y divide-pedra-100 overflow-y-auto">
            {parsed.errors.map((e) => (
              <li key={`e${e.line}`} className="bg-erro-50 px-3 py-2 text-sm text-erro">
                <strong>Linha {e.line}:</strong> {e.message}
                {e.text ? <span className="block truncate text-xs">“{e.text}”</span> : null}
              </li>
            ))}
            {parsed.items.map((i) => (
              <li key={i.line} className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2 text-sm">
                <span className="text-pedra-600">
                  {minToLabel(i.startMin)} – {minToLabel(i.endMin)}
                </span>
                <span>
                  <strong>{i.title}</strong>
                  {i.location || i.responsible ? <span className="block text-xs text-pedra-500">{[i.location, i.responsible].filter(Boolean).join(' · ')}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <FormActions>
        <Link href="/cronograma" className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        <SubmitButton disabled={!parsed.items.length || parsed.errors.length > 0} pendingText="Adicionando…">
          Adicionar {parsed.items.length || ''} momento(s)
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
