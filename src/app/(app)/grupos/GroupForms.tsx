'use client';

import * as React from 'react';
import Link from 'next/link';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Checkbox, Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/layout';
import { formatPhone } from '@/lib/format';
import { createGroup, deleteGroup, updateGroup } from './actions';

export type GroupData = { id: string; name: string; description: string | null; capacity: number | null; notes: string | null };
export type LeaderOption = { membership_id: string; full_name: string; phone: string | null; group_id: string | null; group_name: string | null };

function TenentePicker({ options, selected, groupId }: { options: LeaderOption[] | null; selected: string[]; groupId?: string }) {
  if (options === null) {
    return (
      <div className="sm:col-span-2 rounded-md border border-aviso/25 bg-aviso-50 px-3 py-2.5 text-sm text-[#6E480D]">
        Não há equipe de tenentes. Crie a equipe <strong>Tenente</strong> em{' '}
        <Link href="/equipes/nova" className="font-bold underline">
          Equipes
        </Link>{' '}
        e inscreva os tenentes nela.
      </div>
    );
  }
  return (
    <fieldset className="sm:col-span-2">
      <input type="hidden" name="leaders_present" value="1" />
      <legend className="mb-1.5 text-sm font-bold text-pedra-700">Tenentes</legend>
      {options.length === 0 ? (
        <p className="rounded-md border border-pedra-200 px-3 py-2.5 text-sm text-pedra-500">Ninguém inscrito na equipe Tenente ainda.</p>
      ) : (
        <ul className="max-h-72 divide-y divide-pedra-100 overflow-y-auto rounded-md border border-pedra-200">
          {options.map((o) => {
            const elsewhere = o.group_id !== null && o.group_id !== groupId;
            return (
              <li key={o.membership_id}>
                <label className={`flex items-center gap-3 px-3 py-2.5 ${elsewhere ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                  <Checkbox name="leaders" value={o.membership_id} defaultChecked={selected.includes(o.membership_id)} disabled={elsewhere} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{o.full_name}</span>
                    {o.phone ? <span className="block text-xs text-pedra-500">{formatPhone(o.phone)}</span> : null}
                  </span>
                  {elsewhere ? <Badge>{o.group_name}</Badge> : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-xs text-pedra-500">Integrantes da equipe Tenente. Cada tenente lidera uma tropa só.</p>
    </fieldset>
  );
}

function Fields({ g, leaders, selected }: { g?: GroupData; leaders: LeaderOption[] | null; selected: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome da tropa" name="name" required>
        <Input defaultValue={g?.name ?? ''} placeholder="Ex.: Tropa Betel" />
      </Field>
      <Field label="Limite de integrantes" name="capacity" hint="Deixe em branco para não limitar.">
        <Input type="number" inputMode="numeric" min={1} defaultValue={g?.capacity ?? ''} />
      </Field>
      <TenentePicker options={leaders} selected={selected} groupId={g?.id} />
      <Field label="Descrição" name="description" className="sm:col-span-2">
        <Textarea rows={2} defaultValue={g?.description ?? ''} />
      </Field>
      <Field label="Observações" name="notes" className="sm:col-span-2">
        <Textarea rows={2} defaultValue={g?.notes ?? ''} />
      </Field>
    </div>
  );
}

export function NewGroupForm({ leaders }: { leaders: LeaderOption[] | null }) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-manto hover:underline">
        + Criar tropa
      </button>
    );
  }
  return (
    <ActionForm
      key={key}
      action={createGroup}
      onSuccess={() => {
        setOpen(false);
        setKey((k) => k + 1);
      }}
    >
      <Fields leaders={leaders} selected={[]} />
      <FormActions>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </button>
        <SubmitButton>Criar tropa</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function EditGroupForm({ g, leaders, selected }: { g: GroupData; leaders: LeaderOption[] | null; selected: string[] }) {
  return (
    <ActionForm action={updateGroup}>
      <input type="hidden" name="id" value={g.id} />
      <Fields g={g} leaders={leaders} selected={selected} />
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
