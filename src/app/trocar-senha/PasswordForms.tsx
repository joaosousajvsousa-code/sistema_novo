'use client';

import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { changeOwnPassword, forcedChangePassword } from './actions';

const hint = 'Mínimo de 8 caracteres, com letras e números.';

export function ForcedPasswordForm() {
  return (
    <ActionForm action={forcedChangePassword} className="space-y-4">
      <Field label="Nova senha" name="password" hint={hint} required>
        <PasswordInput autoComplete="new-password" />
      </Field>
      <Field label="Repita a nova senha" name="confirm" required>
        <PasswordInput autoComplete="new-password" />
      </Field>
      <SubmitButton size="lg" className="w-full">
        Salvar senha e entrar
      </SubmitButton>
    </ActionForm>
  );
}

export function ChangePasswordForm() {
  return (
    <ActionForm action={changeOwnPassword} resetOnSuccess className="max-w-md space-y-4">
      <Field label="Senha atual" name="current" required>
        <PasswordInput autoComplete="current-password" />
      </Field>
      <Field label="Nova senha" name="password" hint={hint} required>
        <PasswordInput autoComplete="new-password" />
      </Field>
      <Field label="Repita a nova senha" name="confirm" required>
        <PasswordInput autoComplete="new-password" />
      </Field>
      <SubmitButton>Alterar senha</SubmitButton>
    </ActionForm>
  );
}
