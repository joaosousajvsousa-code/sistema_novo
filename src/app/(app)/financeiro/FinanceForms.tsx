'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionForm, Field, FormActions, SubmitButton, useFieldError } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { FormSection } from '@/components/ui/layout';
import { FileField } from '@/components/FileField';
import { toInputBRL } from '@/lib/money';
import { addEntryDocument, cancelEntry, createCategory, createEntry, saveBankBalance, saveBudgets, toggleCategory, updateEntry } from './actions';

type Option = { id: string; name: string };
export type EntryData = {
  id?: string;
  kind: 'receita' | 'despesa';
  category_id?: string;
  team_id?: string | null;
  description?: string;
  amount?: number | null;
  entry_date?: string;
  responsible?: string | null;
  notes?: string | null;
};

function FileWithError() {
  const error = useFieldError('file');
  return (
    <div className="sm:col-span-2">
      <FileField />
      {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
    </div>
  );
}

export function EntryForm({ entry, categories, teams, today }: { entry: EntryData; categories: Option[]; teams: Option[]; today: string }) {
  const editing = Boolean(entry.id);
  const despesa = entry.kind === 'despesa';
  return (
    <ActionForm action={editing ? updateEntry : createEntry} className="space-y-6">
      <input type="hidden" name="kind" value={entry.kind} />
      {entry.id ? <input type="hidden" name="id" value={entry.id} /> : null}
      <FormSection title={despesa ? 'Despesa' : 'Receita'}>
        <Field label="Descrição" name="description" required className="sm:col-span-2">
          <Input defaultValue={entry.description ?? ''} placeholder={despesa ? 'Ex.: Compra de pães' : 'Ex.: Doação da paróquia'} />
        </Field>
        <Field label="Valor (R$)" name="amount" required>
          <Input inputMode="decimal" defaultValue={toInputBRL(entry.amount)} placeholder="0,00" />
        </Field>
        <Field label="Data" name="entry_date" required>
          <DateInput defaultValue={entry.entry_date ?? today} />
        </Field>
        <Field label={despesa ? 'Categoria' : 'Origem'} name="category_id" required>
          <Select defaultValue={entry.category_id ?? ''}>
            <option value="" disabled>
              Selecione
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {despesa ? (
          <Field label="Equipe relacionada" name="team_id" hint="Opcional. Para ver os gastos por equipe.">
            <Select defaultValue={entry.team_id ?? ''}>
              <option value="">Geral (sem equipe)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div />
        )}
        <Field label={despesa ? 'Responsável pela compra' : 'Quem doou / responsável'} name="responsible">
          <Input defaultValue={entry.responsible ?? ''} />
        </Field>
        <Field label="Observações" name="notes" className="sm:col-span-2">
          <Textarea rows={2} defaultValue={entry.notes ?? ''} />
        </Field>
        {!editing ? <FileWithError /> : null}
      </FormSection>
      <FormActions>
        <Link href={`/financeiro/lancamentos?tipo=${entry.kind}`} className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          {editing ? 'Voltar' : 'Cancelar'}
        </Link>
        {!editing ? (
          <SubmitButton variant="secondary" name="next" value="another">
            Salvar e lançar outra
          </SubmitButton>
        ) : null}
        <SubmitButton name="next" value="list">
          {editing ? 'Salvar alterações' : despesa ? 'Lançar despesa' : 'Lançar receita'}
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function CancelEntryForm({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionForm action={cancelEntry} onSuccess={() => router.refresh()} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Motivo" name="reason" required>
        <Input maxLength={300} placeholder="Ex.: lançado em duplicidade" />
      </Field>
      <SubmitButton variant="quiet-danger" className="border border-erro/30" confirmMessage="Cancelar este lançamento? Ele continua no histórico, mas sai dos totais.">
        Cancelar lançamento
      </SubmitButton>
    </ActionForm>
  );
}

export function AddDocumentForm({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionForm action={addEntryDocument} resetOnSuccess onSuccess={() => router.refresh()} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <FileWithError />
      <SubmitButton variant="secondary">Enviar comprovante</SubmitButton>
    </ActionForm>
  );
}

export function BudgetForm({ rows }: { rows: { id: string; name: string; budget: number | null; spent: number }[] }) {
  return (
    <ActionForm action={saveBudgets} className="space-y-4">
      <ul className="divide-y divide-pedra-100">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_140px] items-center gap-3 py-2">
            <label htmlFor={`f-budget.${r.id}`} className="text-sm">
              <span className="font-bold">{r.name}</span>
              <span className="block text-xs text-pedra-500">Gasto até agora: {r.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </label>
            <BudgetInput id={r.id} value={r.budget} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-pedra-500">Deixe em branco a categoria sem orçamento.</p>
      <SubmitButton>Salvar orçamento</SubmitButton>
    </ActionForm>
  );
}

function BudgetInput({ id, value }: { id: string; value: number | null }) {
  const error = useFieldError(`budget.${id}`);
  return (
    <div>
      <Input id={`f-budget.${id}`} name={`budget.${id}`} inputMode="decimal" defaultValue={toInputBRL(value)} placeholder="0,00" aria-invalid={error ? true : undefined} />
      {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
    </div>
  );
}

export function NewCategoryForm({ kind }: { kind: 'receita' | 'despesa' }) {
  const router = useRouter();
  return (
    <ActionForm action={createCategory} resetOnSuccess onSuccess={() => router.refresh()} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="kind" value={kind} />
      <Field label={kind === 'despesa' ? 'Nova categoria de despesa' : 'Nova origem de receita'} name="name" className="flex-1">
        <Input maxLength={60} />
      </Field>
      <SubmitButton variant="secondary">Adicionar</SubmitButton>
    </ActionForm>
  );
}

export function ToggleCategoryButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return (
    <ActionForm action={toggleCategory} onSuccess={() => router.refresh()}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <SubmitButton variant="ghost" size="sm" pendingText="">
        {active ? 'Desativar' : 'Reativar'}
      </SubmitButton>
    </ActionForm>
  );
}

export function BankBalanceForm({ amount, date, today }: { amount: number | null; date: string | null; today: string }) {
  const router = useRouter();
  return (
    <ActionForm action={saveBankBalance} onSuccess={() => router.refresh()} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Saldo no banco (R$)" name="amount" hint="Deixe em branco para remover.">
        <Input inputMode="decimal" defaultValue={toInputBRL(amount)} placeholder="0,00" />
      </Field>
      <Field label="Conferido em" name="date">
        <DateInput defaultValue={date ?? today} />
      </Field>
      <SubmitButton variant="secondary">Salvar saldo</SubmitButton>
    </ActionForm>
  );
}
