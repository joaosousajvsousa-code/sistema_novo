'use client';

import * as React from 'react';
import { Check, Copy, MessageCircle, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Select } from '@/components/ui/input';
import { buttonClass } from '@/components/ui/button';
import { addCoordinator, regenerateLink, removeCoordinator } from './actions';

export function ShareLink({ url, teamName, teamId, canRegenerate }: { url: string; teamName: string; teamId: string; canRegenerate: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const message = `Inscrição para servir na equipe ${teamName}: ${url}`;
  return (
    <div className="space-y-3">
      <div className="break-all rounded-md border border-pedra-200 bg-pedra px-3 py-2.5 text-sm text-pedra-700">{url}</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass('primary', 'md')}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Link copiado' : 'Copiar link'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
          <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
        </a>
      </div>
      {canRegenerate ? (
        <ActionForm action={regenerateLink}>
          <input type="hidden" name="id" value={teamId} />
          <SubmitButton
            variant="ghost"
            size="sm"
            confirmMessage="Gerar um novo link? O link atual deixa de funcionar para quem ainda não se inscreveu."
            pendingText="Gerando…"
          >
            <RefreshCw className="h-4 w-4" /> Gerar novo link
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}

export function AddCoordinatorForm({ teamId, users }: { teamId: string; users: { id: string; full_name: string; username: string }[] }) {
  if (!users.length) return <p className="text-xs text-pedra-500">Todos os usuários ativos já coordenam esta equipe ou não há usuários cadastrados.</p>;
  return (
    <ActionForm action={addCoordinator} resetOnSuccess className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="team_id" value={teamId} />
      <Field label="Adicionar coordenador" name="user_id" className="flex-1">
        <Select defaultValue="">
          <option value="" disabled>
            Escolha um usuário
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} (@{u.username})
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary">Adicionar</SubmitButton>
    </ActionForm>
  );
}

export function RemoveCoordinatorButton({ teamId, userId, name }: { teamId: string; userId: string; name: string }) {
  return (
    <ActionForm action={removeCoordinator}>
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="user_id" value={userId} />
      <SubmitButton variant="ghost" size="sm" aria-label={`Remover ${name}`} confirmMessage={`Remover ${name} da coordenação desta equipe?`} pendingText="">
        <X className="h-4 w-4" />
      </SubmitButton>
    </ActionForm>
  );
}
