'use client';

import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { createFirstAdmin } from './actions';

export function FirstAdminForm() {
  return (
    <ActionForm action={createFirstAdmin} className="space-y-4">
      <Field label="Código de configuração" name="code" hint="É o valor de INITIAL_SETUP_CODE definido na hospedagem." required>
        <PasswordInput autoComplete="off" />
      </Field>
      <Field label="Seu nome" name="full_name" required>
        <Input autoComplete="name" />
      </Field>
      <Field label="Nome de usuário" name="username" hint="Ex.: joao.sousa — é com ele que você vai entrar." required>
        <Input autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" />
      </Field>
      <Field label="Senha" name="password" hint="Mínimo de 8 caracteres, com letras e números." required>
        <PasswordInput autoComplete="new-password" />
      </Field>
      <Field label="Repita a senha" name="confirm" required>
        <PasswordInput autoComplete="new-password" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Criando…">
        Criar administrador
      </SubmitButton>
    </ActionForm>
  );
}
