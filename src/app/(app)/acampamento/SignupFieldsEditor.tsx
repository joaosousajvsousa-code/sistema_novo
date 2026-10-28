'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Checkbox, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type FieldDef = { label: string; type: 'text' | 'select'; required: boolean; options: string[] };

export function SignupFieldsEditor({ initial }: { initial: FieldDef[] }) {
  const [fields, setFields] = React.useState<FieldDef[]>(initial);
  const update = (i: number, patch: Partial<FieldDef>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="sm:col-span-2">
      <input type="hidden" name="signup_fields" value={JSON.stringify(fields)} />
      {fields.length === 0 ? (
        <p className="mb-3 text-sm text-pedra-500">Nenhum campo extra. O formulário pede nome, telefone, nascimento e camiseta.</p>
      ) : (
        <ul className="mb-3 space-y-3">
          {fields.map((f, i) => (
            <li key={i} className="rounded-md border border-pedra-200 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <div>
                  <label className="mb-1 block text-xs font-bold text-pedra-600" htmlFor={`sf-label-${i}`}>
                    Pergunta
                  </label>
                  <Input id={`sf-label-${i}`} value={f.label} maxLength={60} onChange={(e) => update(i, { label: e.target.value })} placeholder="Ex.: Paróquia" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-pedra-600" htmlFor={`sf-type-${i}`}>
                    Tipo de resposta
                  </label>
                  <Select id={`sf-type-${i}`} value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldDef['type'] })}>
                    <option value="text">Texto livre</option>
                    <option value="select">Lista de opções</option>
                  </Select>
                </div>
              </div>
              {f.type === 'select' ? (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-bold text-pedra-600" htmlFor={`sf-opt-${i}`}>
                    Opções, separadas por vírgula
                  </label>
                  <Input
                    id={`sf-opt-${i}`}
                    defaultValue={f.options.join(', ')}
                    onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="Ex.: Sim, Não"
                  />
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  Resposta obrigatória
                </label>
                <Button variant="quiet-danger" size="sm" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" /> Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {fields.length < 10 ? (
        <Button variant="secondary" size="sm" onClick={() => setFields((fs) => [...fs, { label: '', type: 'text', required: false, options: [] }])}>
          <Plus className="h-4 w-4" /> Adicionar pergunta
        </Button>
      ) : null}
    </div>
  );
}
