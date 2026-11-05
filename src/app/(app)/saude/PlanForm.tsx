'use client';

import Link from 'next/link';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { FormSection } from '@/components/ui/layout';
import { savePlan, setPlanActive } from './actions';

export type PlanData = {
  id?: string;
  encontrista_id?: string;
  medication?: string;
  dose?: string | null;
  times?: string;
  start_date?: string | null;
  end_date?: string | null;
  instructions?: string | null;
};
export type RecrutaOption = { id: string; full_name: string; group_name: string | null };

export function PlanForm({ plan, recrutas }: { plan: PlanData; recrutas: RecrutaOption[] }) {
  const editing = Boolean(plan.id);
  const byGroup = new Map<string, RecrutaOption[]>();
  for (const r of recrutas) byGroup.set(r.group_name ?? 'Sem tropa', [...(byGroup.get(r.group_name ?? 'Sem tropa') ?? []), r]);
  return (
    <ActionForm action={savePlan} className="space-y-6">
      {plan.id ? <input type="hidden" name="id" value={plan.id} /> : null}
      <FormSection title="Remédio">
        <Field label="Recruta" name="encontrista_id" required className="sm:col-span-2">
          <Select defaultValue={plan.encontrista_id ?? ''}>
            <option value="" disabled>
              Escolha o recruta
            </option>
            {Array.from(byGroup.entries())
              .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
              .map(([g, list]) => (
                <optgroup key={g} label={g}>
                  {list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </Select>
        </Field>
        <Field label="Remédio" name="medication" required>
          <Input defaultValue={plan.medication ?? ''} placeholder="Ex.: Amoxicilina" maxLength={120} />
        </Field>
        <Field label="Dose" name="dose">
          <Input defaultValue={plan.dose ?? ''} placeholder="Ex.: 1 comprimido de 500 mg" maxLength={120} />
        </Field>
        <Field label="Horários" name="times" required hint="Separe por vírgula. Ex.: 08:00, 14:00, 20:00" className="sm:col-span-2">
          <Input defaultValue={plan.times ?? ''} placeholder="08:00, 20:00" inputMode="numeric" />
        </Field>
        <Field label="A partir de" name="start_date" hint="Deixe vazio para todos os dias.">
          <DateInput defaultValue={plan.start_date ?? ''} />
        </Field>
        <Field label="Até" name="end_date">
          <DateInput defaultValue={plan.end_date ?? ''} />
        </Field>
        <Field label="Instruções" name="instructions" className="sm:col-span-2">
          <Textarea rows={2} defaultValue={plan.instructions ?? ''} placeholder="Ex.: dar depois do almoço, com água" maxLength={500} />
        </Field>
      </FormSection>
      <FormActions>
        <Link href="/saude" className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        {!editing ? (
          <SubmitButton variant="secondary" name="next" value="another">
            Salvar e adicionar outro
          </SubmitButton>
        ) : null}
        <SubmitButton name="next" value="list">
          {editing ? 'Salvar remédio' : 'Adicionar remédio'}
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function PlanActiveForm({ id, active }: { id: string; active: boolean }) {
  return (
    <ActionForm action={setPlanActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <SubmitButton
        size="sm"
        variant={active ? 'quiet-danger' : 'ghost'}
        pendingText="…"
        confirmMessage={active ? 'Suspender este remédio? Ele sai do cronograma.' : undefined}
      >
        {active ? 'Suspender' : 'Reativar'}
      </SubmitButton>
    </ActionForm>
  );
}
