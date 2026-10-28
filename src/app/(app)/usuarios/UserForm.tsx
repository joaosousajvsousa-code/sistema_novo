'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import { ActionForm, Field, FormActions, SubmitButton, useFieldError } from '@/components/ui/form';
import { Checkbox, Input } from '@/components/ui/input';
import { FormSection, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import type { ActionState } from '@/lib/action';
import { createUser, updateUser } from './actions';

export type RoleOption = { key: string; name: string; description: string; includes: string[] };
export type PermOption = { key: string; name: string; description: string; module: string };

function RolePicker({ roles, selected, canGrantAdmin }: { roles: RoleOption[]; selected: string[]; canGrantAdmin: boolean }) {
  const error = useFieldError('roles');
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm font-bold text-pedra-700">
        Perfis <span className="text-erro">*</span>
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {roles.map((r) => {
          const disabled = r.key === 'admin' && !canGrantAdmin;
          return (
            <li key={r.key}>
              <label className="flex h-full cursor-pointer gap-3 rounded-md border border-pedra-200 p-3 has-[:checked]:border-manto has-[:checked]:bg-manto-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <Checkbox name="roles" value={r.key} defaultChecked={selected.includes(r.key)} disabled={disabled} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-bold">{r.name}</span>
                  <span className="block text-xs text-pedra-500">{r.description}</span>
                </span>
              </label>
              {disabled && selected.includes(r.key) ? <input type="hidden" name="roles" value={r.key} /> : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
    </div>
  );
}

function PermPicker({ perms, selected }: { perms: PermOption[]; selected: string[] }) {
  const modules = Array.from(new Set(perms.map((p) => p.module)));
  return (
    <div className="space-y-4 sm:col-span-2">
      {modules.map((m) => (
        <div key={m}>
          <p className="mb-1 text-xs text-pedra-500">{m}</p>
          <ul className="divide-y divide-pedra-100 rounded-md border border-pedra-200">
            {perms
              .filter((p) => p.module === m)
              .map((p) => (
                <li key={p.key}>
                  <label className="flex cursor-pointer gap-3 px-3 py-2.5">
                    <Checkbox name="permissions" value={p.key} defaultChecked={selected.includes(p.key)} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-bold">{p.name}</span>
                      <span className="block text-xs text-pedra-500">{p.description}</span>
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function CopyableSecret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="flex-1 rounded-md border border-pedra-300 bg-white px-3 py-2 text-base font-bold tracking-wide text-pedra-900" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-pedra-300 bg-white px-3 text-sm font-bold text-manto"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

export function NewUserForm({
  roles,
  perms,
  canGrantAdmin,
  suggestedPassword,
}: {
  roles: RoleOption[];
  perms: PermOption[];
  canGrantAdmin: boolean;
  suggestedPassword: string;
}) {
  const [created, setCreated] = React.useState<{ userId: string; username: string; password: string } | null>(null);

  if (created) {
    return (
      <div className="space-y-4">
        <Notice tone="ok" title="Usuário criado">
          Repasse estes dados para a pessoa. A senha temporária aparece só agora; no primeiro acesso ela vai criar uma senha pessoal.
        </Notice>
        <div>
          <p className="text-sm font-bold text-pedra-700">Usuário</p>
          <CopyableSecret label="Usuário" value={created.username} />
        </div>
        <div>
          <p className="text-sm font-bold text-pedra-700">Senha temporária</p>
          <CopyableSecret label="Senha temporária" value={created.password} />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <ButtonLink href={`/usuarios/${created.userId}`}>Ver usuário</ButtonLink>
          <ButtonLink href="/usuarios" variant="secondary">
            Voltar para a lista
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <ActionForm
      action={createUser}
      showSuccessToast={false}
      onSuccess={(s: ActionState) => setCreated(s.data as { userId: string; username: string; password: string })}
      className="space-y-6"
    >
      <FormSection title="Identificação" description="O nome de usuário é usado para entrar e não pode ser alterado depois.">
        <Field label="Nome completo" name="full_name" required>
          <Input autoComplete="off" />
        </Field>
        <Field label="Telefone" name="phone" hint="Opcional, com DDD.">
          <Input type="tel" inputMode="tel" autoComplete="off" />
        </Field>
        <Field label="Nome de usuário" name="username" hint="Ex.: maria.silva" required>
          <Input autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
        </Field>
        <Field label="Senha temporária" name="temp_password" hint="Gerada automaticamente. A pessoa troca no primeiro acesso." required>
          <Input defaultValue={suggestedPassword} autoComplete="off" spellCheck={false} />
        </Field>
      </FormSection>
      <FormSection title="Perfil de acesso" description="O perfil define o que a pessoa vê. Coordenadores de equipe são vinculados na tela da equipe.">
        <RolePicker roles={roles} selected={[]} canGrantAdmin={canGrantAdmin} />
      </FormSection>
      <FormSection title="Permissões extras" description="Use para liberar algo além do perfil, como ver dados de saúde.">
        <PermPicker perms={perms} selected={[]} />
      </FormSection>
      <FormActions>
        <Link href="/usuarios" className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        <SubmitButton pendingText="Criando…">Criar usuário</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function EditUserForm({
  user,
  roles,
  perms,
  selectedRoles,
  selectedPerms,
  canGrantAdmin,
}: {
  user: { id: string; full_name: string; phone: string | null };
  roles: RoleOption[];
  perms: PermOption[];
  selectedRoles: string[];
  selectedPerms: string[];
  canGrantAdmin: boolean;
}) {
  return (
    <ActionForm action={updateUser} className="space-y-6">
      <input type="hidden" name="id" value={user.id} />
      <FormSection title="Identificação">
        <Field label="Nome completo" name="full_name" required>
          <Input defaultValue={user.full_name} />
        </Field>
        <Field label="Telefone" name="phone" hint="Opcional, com DDD.">
          <Input type="tel" inputMode="tel" defaultValue={user.phone ?? ''} />
        </Field>
      </FormSection>
      <FormSection title="Perfil de acesso">
        <RolePicker roles={roles} selected={selectedRoles} canGrantAdmin={canGrantAdmin} />
      </FormSection>
      <FormSection title="Permissões extras" description="Somadas às do perfil.">
        <PermPicker perms={perms} selected={selectedPerms} />
      </FormSection>
      <FormActions>
        <SubmitButton>Salvar alterações</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
