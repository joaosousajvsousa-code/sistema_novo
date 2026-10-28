'use client';

import Link from 'next/link';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/ui/layout';
import { createTeam, deleteTeam, updateTeam } from './actions';

export type TeamData = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  status: string;
  internal_notes: string | null;
};

export function TeamForm({ team, occupied }: { team?: TeamData; occupied?: number }) {
  return (
    <ActionForm action={team ? updateTeam : createTeam} className="space-y-6">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <FormSection title="Equipe">
        <Field label="Nome" name="name" required className="sm:col-span-2">
          <Input defaultValue={team?.name ?? ''} placeholder="Ex.: Cozinha" />
        </Field>
        <Field label="Descrição" name="description" hint="Aparece no link de inscrição." className="sm:col-span-2">
          <Textarea defaultValue={team?.description ?? ''} />
        </Field>
      </FormSection>
      <FormSection title="Vagas e inscrições" description="Quando o limite é atingido, o link para de aceitar inscrições automaticamente.">
        <Field
          label="Limite de integrantes"
          name="capacity"
          hint={occupied !== undefined ? `Hoje há ${occupied} inscrição(ões) ativa(s).` : undefined}
          required
        >
          <Input type="number" inputMode="numeric" min={1} max={2000} defaultValue={team?.capacity ?? ''} />
        </Field>
        <Field label="Situação" name="status" required>
          <Select defaultValue={team?.status ?? 'aberta'}>
            <option value="aberta">Inscrições abertas</option>
            <option value="fechada">Inscrições fechadas</option>
            <option value="inativa">Inativa</option>
          </Select>
        </Field>
      </FormSection>
      <FormSection title="Observações internas" description="Visíveis só para a coordenação, nunca no link público.">
        <Field label="Observações" name="internal_notes" className="sm:col-span-2">
          <Textarea defaultValue={team?.internal_notes ?? ''} />
        </Field>
      </FormSection>
      <FormActions>
        <Link
          href={team ? `/equipes/${team.id}` : '/equipes'}
          className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600"
        >
          Cancelar
        </Link>
        <SubmitButton>{team ? 'Salvar equipe' : 'Criar equipe'}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function DeleteTeamForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteTeam}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="quiet-danger" className="border border-erro/30" confirmMessage="Excluir esta equipe definitivamente?" pendingText="Excluindo…">
        Excluir equipe
      </SubmitButton>
    </ActionForm>
  );
}
