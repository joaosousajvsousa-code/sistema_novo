'use client';

import * as React from 'react';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Input, Textarea } from '@/components/ui/input';
import { createGroup, deleteGroup, updateGroup } from './actions';

export type GroupData = { id: string; name: string; description: string | null; responsaveis: string | null; capacity: number | null; notes: string | null };

function Fields({ g }: { g?: GroupData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome da tropa" name="name" required>
        <Input defaultValue={g?.name ?? ''} placeholder="Ex.: Tropa São Francisco" />
      </Field>
      <Field label="Limite de integrantes" name="capacity" hint="Deixe em branco para não limitar.">
        <Input type="number" inputMode="numeric" min={1} defaultValue={g?.capacity ?? ''} />
      </Field>
      <Field label="Responsáveis" name="responsaveis" className="sm:col-span-2">
        <Input defaultValue={g?.responsaveis ?? ''} placeholder="Ex.: Ana e Pedro" />
      </Field>
      <Field label="Descrição" name="description" className="sm:col-span-2">
        <Textarea rows={2} defaultValue={g?.description ?? ''} />
      </Field>
      <Field label="Observações" name="notes" className="sm:col-span-2">
        <Textarea rows={2} defaultValue={g?.notes ?? ''} />
      </Field>
    </div>
  );
}

export function NewGroupForm() {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-manto hover:underline">
        + Criar tropa
      </button>
    );
  }
  return (
    <ActionForm action={createGroup} resetOnSuccess onSuccess={() => setOpen(false)}>
      <Fields />
      <FormActions>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </button>
        <SubmitButton>Criar tropa</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function EditGroupForm({ g }: { g: GroupData }) {
  return (
    <ActionForm action={updateGroup}>
      <input type="hidden" name="id" value={g.id} />
      <Fields g={g} />
      <FormActions>
        <SubmitButton>Salvar tropa</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function DeleteGroupForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteGroup}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="quiet-danger" className="border border-erro/30" confirmMessage="Excluir esta tropa?" pendingText="Excluindo…">
        Excluir tropa
      </SubmitButton>
    </ActionForm>
  );
}
