'use client';

import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Input, Select } from '@/components/ui/input';
import { moveServidor, setServidorStatus } from '../actions';

export function StatusForm({ id, status }: { id: string; status: string }) {
  if (status === 'cancelada') {
    return (
      <ActionForm action={setServidorStatus}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="ativa" />
        <p className="mb-2 text-xs text-pedra-500">A reativação só é possível se a equipe tiver vaga.</p>
        <SubmitButton variant="secondary">Reativar inscrição</SubmitButton>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={setServidorStatus} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value="cancelada" />
      <Field label="Motivo (opcional)" name="reason">
        <Input maxLength={500} />
      </Field>
      <SubmitButton variant="quiet-danger" className="border border-erro/30" confirmMessage="Cancelar esta inscrição? A vaga será liberada.">
        Cancelar inscrição
      </SubmitButton>
    </ActionForm>
  );
}

export function MoveForm({ id, teams }: { id: string; teams: { id: string; name: string; available: number }[] }) {
  return (
    <ActionForm action={moveServidor} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Nova equipe" name="team_id">
        <Select defaultValue="">
          <option value="" disabled>
            Selecione
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.available <= 0}>
              {t.name} — {t.available > 0 ? `${t.available} vaga(s)` : 'esgotada'}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary" confirmMessage="Transferir este soldado/servo para a equipe escolhida?">
        Transferir
      </SubmitButton>
    </ActionForm>
  );
}
