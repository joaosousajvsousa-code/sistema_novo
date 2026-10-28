'use client';

import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Select } from '@/components/ui/input';
import { setEncontristaGroup, setEncontristaStatus } from '../actions';

export function GroupForm({ id, current, groups }: { id: string; current: string | null; groups: { id: string; name: string; capacity: number | null; occupied: number }[] }) {
  return (
    <ActionForm action={setEncontristaGroup} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="id" value={id} />
      <Field label={current ? 'Realocar para' : 'Atribuir ao grupo'} name="group_id" className="flex-1">
        <Select defaultValue={current ?? ''}>
          <option value="">Sem grupo</option>
          {groups.map((g) => {
            const full = g.capacity !== null && g.occupied >= g.capacity && g.id !== current;
            return (
              <option key={g.id} value={g.id} disabled={full}>
                {g.name}
                {g.capacity !== null ? ` — ${g.occupied}/${g.capacity}` : ` — ${g.occupied}`}
                {full ? ' (cheio)' : ''}
              </option>
            );
          })}
        </Select>
      </Field>
      <SubmitButton variant="secondary">Salvar grupo</SubmitButton>
    </ActionForm>
  );
}

export function FichaStatusForm({ id, status }: { id: string; status: string }) {
  const cancel = status === 'ativo';
  return (
    <ActionForm action={setEncontristaStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={cancel ? 'cancelado' : 'ativo'} />
      <SubmitButton
        variant={cancel ? 'quiet-danger' : 'secondary'}
        className={cancel ? 'border border-erro/30' : undefined}
        confirmMessage={cancel ? 'Cancelar esta ficha? O encontrista sai das contagens, do grupo e dos relatórios.' : undefined}
      >
        {cancel ? 'Cancelar ficha' : 'Reativar ficha'}
      </SubmitButton>
    </ActionForm>
  );
}
