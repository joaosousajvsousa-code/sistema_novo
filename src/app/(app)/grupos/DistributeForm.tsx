'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Checkbox, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/layout';
import { cn } from '@/lib/cn';
import { assignMany } from './actions';

type Row = { id: string; full_name: string; age: number | null; group_name: string | null; shirt_size: string | null };
type Group = { id: string; name: string; capacity: number | null; occupied: number };

export function DistributeForm({ rows, groups, allowRemove }: { rows: Row[]; groups: Group[]; allowRemove: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <ActionForm
      action={assignMany}
      onSuccess={() => {
        setSelected(new Set());
        router.refresh();
      }}
    >
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <div className="rounded-lg border border-pedra-200 bg-white">
        <label className="flex items-center gap-3 border-b border-pedra-200 px-4 py-3 text-sm font-bold sm:px-5">
          <Checkbox
            checked={allChecked}
            onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
            aria-label="Selecionar todos desta página"
          />
          Selecionar todos desta página
        </label>
        <ul className="divide-y divide-pedra-100">
          {rows.map((r) => (
            <li key={r.id}>
              <label className={cn('flex cursor-pointer items-center gap-3 px-4 py-3 sm:px-5', selected.has(r.id) && 'bg-manto-50')}>
                <Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.full_name}</span>
                  <span className="block text-xs text-pedra-500">
                    {r.age !== null ? `${r.age} anos` : 'Idade não informada'}
                    {r.shirt_size ? ` · camiseta ${r.shirt_size}` : ''}
                  </span>
                </span>
                {r.group_name ? <Badge tone="manto">{r.group_name}</Badge> : <Badge tone="aviso">Sem grupo</Badge>}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky bottom-16 z-10 -mx-4 mt-4 border-t border-pedra-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border lg:bottom-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <p className="text-sm sm:mb-3 sm:w-40">
            <strong>{selected.size}</strong> selecionado(s)
          </p>
          <Field label="Destino" name="group_id" className="flex-1">
            <Select defaultValue="">
              <option value="" disabled>
                Escolha o grupo
              </option>
              {groups.map((g) => {
                const free = g.capacity !== null ? g.capacity - g.occupied : null;
                return (
                  <option key={g.id} value={g.id} disabled={free !== null && free <= 0}>
                    {g.name} — {g.occupied}
                    {g.capacity !== null ? `/${g.capacity}` : ''}
                    {free !== null ? (free > 0 ? ` (${free} vaga(s))` : ' (cheio)') : ''}
                  </option>
                );
              })}
              {allowRemove ? <option value="remover">Remover do grupo atual</option> : null}
            </Select>
          </Field>
          <SubmitButton disabled={selected.size === 0}>Aplicar</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
