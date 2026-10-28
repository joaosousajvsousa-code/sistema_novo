'use client';

import * as React from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Notice } from '@/components/ui/layout';
import type { ActionState } from '@/lib/action';
import { CopyableSecret } from '../UserForm';
import { resetUserPassword, revokeSessions, setUserActive } from '../actions';

export function UserAdminActions({ id, active, isSelf }: { id: string; active: boolean; isSelf: boolean }) {
  const [password, setPassword] = React.useState<string | null>(null);
  return (
    <div className="space-y-5">
      {!isSelf ? (
        <div>
          <p className="text-sm font-bold">Redefinir senha</p>
          <p className="mb-2 text-xs text-pedra-500">Gera uma senha temporária e desconecta a pessoa. Ela cria uma nova senha ao entrar.</p>
          {password ? (
            <Notice tone="ok" title="Nova senha temporária">
              Repasse para a pessoa. Ela aparece só agora.
              <CopyableSecret label="Senha temporária" value={password} />
            </Notice>
          ) : (
            <ActionForm action={resetUserPassword} onSuccess={(s: ActionState) => setPassword(String(s.data?.password ?? ''))} showSuccessToast={false}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton variant="secondary" confirmMessage="Gerar uma nova senha temporária para este usuário?">
                Gerar senha temporária
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      ) : null}
      <div>
        <p className="text-sm font-bold">Encerrar sessões</p>
        <p className="mb-2 text-xs text-pedra-500">Desconecta o usuário de todos os aparelhos.</p>
        <ActionForm action={revokeSessions}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="secondary" confirmMessage="Desconectar este usuário de todos os aparelhos?">
            Encerrar sessões
          </SubmitButton>
        </ActionForm>
      </div>
      {!isSelf ? (
        <div>
          <p className="text-sm font-bold">{active ? 'Desativar acesso' : 'Reativar acesso'}</p>
          <p className="mb-2 text-xs text-pedra-500">
            {active ? 'A pessoa deixa de entrar no sistema. O histórico é mantido.' : 'A pessoa volta a entrar com a senha atual.'}
          </p>
          <ActionForm action={setUserActive}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="active" value={active ? 'false' : 'true'} />
            <SubmitButton
              variant={active ? 'quiet-danger' : 'secondary'}
              className={active ? 'border border-erro/30' : undefined}
              confirmMessage={active ? 'Desativar o acesso deste usuário?' : undefined}
            >
              {active ? 'Desativar usuário' : 'Reativar usuário'}
            </SubmitButton>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
