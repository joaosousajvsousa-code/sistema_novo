'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Play, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Input, Textarea } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { TimeInput } from '@/components/ui/time-input';
import { FormSection } from '@/components/ui/layout';
import { deleteItem, createItem, resetToOriginal, setStatus, shiftAfter, updateItem } from './actions';

export type ItemFormData = {
  id?: string;
  title?: string;
  date?: string;
  start?: string;
  end?: string;
  location?: string | null;
  responsible?: string | null;
  description?: string | null;
  notes?: string | null;
};

export function ItemForm({ item }: { item: ItemFormData }) {
  const editing = Boolean(item.id);
  return (
    <ActionForm action={editing ? updateItem : createItem} className="space-y-6">
      {item.id ? <input type="hidden" name="id" value={item.id} /> : null}
      <FormSection title="Momento">
        <Field label="Nome do momento" name="title" required className="sm:col-span-2">
          <Input defaultValue={item.title ?? ''} placeholder="Ex.: Missa de abertura" />
        </Field>
        <Field label="Dia" name="date" required>
          <DateInput defaultValue={item.date ?? ''} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" name="start" required>
            <TimeInput defaultValue={item.start ?? ''} />
          </Field>
          <Field label="Término" name="end" required hint="Se for menor que o início, vale para o dia seguinte.">
            <TimeInput defaultValue={item.end ?? ''} />
          </Field>
        </div>
        <Field label="Local" name="location">
          <Input defaultValue={item.location ?? ''} placeholder="Ex.: Capela" />
        </Field>
        <Field label="Responsável" name="responsible">
          <Input defaultValue={item.responsible ?? ''} placeholder="Ex.: Equipe de liturgia" />
        </Field>
        <Field label="Descrição" name="description" className="sm:col-span-2">
          <Textarea rows={2} defaultValue={item.description ?? ''} />
        </Field>
        <Field label="Observações" name="notes" className="sm:col-span-2">
          <Textarea rows={2} defaultValue={item.notes ?? ''} />
        </Field>
      </FormSection>
      <FormActions>
        <Link href="/cronograma" className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold text-pedra-600">
          Cancelar
        </Link>
        {!editing ? (
          <SubmitButton variant="secondary" name="next" value="another">
            Salvar e adicionar outro
          </SubmitButton>
        ) : null}
        <SubmitButton name="next" value="list">
          {editing ? 'Salvar momento' : 'Adicionar momento'}
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function DeleteItemForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteItem}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="quiet-danger" className="border border-erro/30" confirmMessage="Excluir este momento do cronograma?" pendingText="Excluindo…">
        Excluir momento
      </SubmitButton>
    </ActionForm>
  );
}

function useRefreshOnSuccess() {
  const router = useRouter();
  return () => router.refresh();
}

export function StatusButton({
  id,
  status,
  label,
  variant = 'secondary',
  size = 'md',
  confirm,
  icon,
  className,
}: {
  id: string;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'quiet-danger';
  size?: 'sm' | 'md' | 'lg';
  confirm?: string;
  icon?: 'play' | 'check' | 'x' | 'undo';
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const Icon = icon === 'play' ? Play : icon === 'check' ? Check : icon === 'x' ? X : icon === 'undo' ? RotateCcw : null;

  // O botão some da tela assim que a situação muda; por isso o aviso é
  // disparado aqui, independente do componente continuar montado.
  function run() {
    if (confirm && !window.confirm(confirm)) return;
    const fd = new FormData();
    fd.set('id', id);
    fd.set('status', status);
    startTransition(async () => {
      try {
        const res = await setStatus({}, fd);
        if (res.ok) toast.success(res.message ?? 'Salvo.');
        else toast.error(res.error ?? 'Não foi possível salvar.');
      } catch {
        toast.error('Sem conexão. Tente de novo.');
      }
      router.refresh();
    });
  }

  return (
    <div className={className}>
      <Button variant={variant} size={size} onClick={run} disabled={pending} aria-busy={pending || undefined} className="w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </Button>
    </div>
  );
}

export function ShiftForm({ id, suggested }: { id: string; suggested: number }) {
  const refresh = useRefreshOnSuccess();
  return (
    <ActionForm action={shiftAfter} onSuccess={refresh} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="id" value={id} />
      <Field label="Empurrar os próximos momentos em (min)" name="minutes" className="sm:w-64">
        <Input type="number" inputMode="numeric" defaultValue={suggested > 0 ? suggested : ''} min={-720} max={720} />
      </Field>
      <SubmitButton variant="secondary" confirmMessage="Ajustar o horário previsto de todos os próximos momentos? O cronograma original continua guardado.">
        Ajustar horários
      </SubmitButton>
    </ActionForm>
  );
}

export function ResetOriginalForm() {
  const refresh = useRefreshOnSuccess();
  return (
    <ActionForm action={resetToOriginal} onSuccess={refresh}>
      <SubmitButton variant="ghost" size="sm" confirmMessage="Voltar todos os momentos ainda não iniciados para o horário original?">
        <RotateCcw className="h-4 w-4" /> Voltar ao horário original
      </SubmitButton>
    </ActionForm>
  );
}

// Mantém a tela atualizada para todos, sem recarregar a página.
export function AutoRefresh({ seconds = 15, renderedAt }: { seconds?: number; renderedAt: string }) {
  const router = useRouter();
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = window.setInterval(tick, seconds * 1000);
    const onVisible = () => document.visibilityState === 'visible' && router.refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router, seconds]);
  return (
    <span className="flex items-center gap-1.5 text-xs text-pedra-500" aria-live="polite">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-40 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      Ao vivo · atualizado às {renderedAt}
    </span>
  );
}

// Tique da lista: um toque marca que o momento começou; no momento em
// andamento, um toque conclui. Concluídos mostram o check.
export function TickButton({
  id,
  title,
  status,
  canManage,
}: {
  id: string;
  title: string;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const target = status === 'agendada' ? 'em_andamento' : status === 'em_andamento' ? 'concluida' : null;
  const label =
    status === 'agendada' ? `Marcar que “${title}” começou` : status === 'em_andamento' ? `Concluir “${title}”` : status === 'concluida' ? 'Concluído' : 'Cancelado';

  const face =
    status === 'concluida' ? (
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ok text-white">
        <Check className="h-6 w-6" strokeWidth={3} />
      </span>
    ) : status === 'em_andamento' ? (
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-cirio bg-cirio/15 text-cirio-700">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" fill="currentColor" />}
      </span>
    ) : status === 'cancelada' ? (
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-pedra-200 text-pedra-400">
        <X className="h-5 w-5" />
      </span>
    ) : (
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-pedra-300 bg-white text-transparent transition-colors group-hover:border-manto group-hover:text-manto/40">
        {pending ? <Loader2 className="h-5 w-5 animate-spin text-manto" /> : <Check className="h-6 w-6" strokeWidth={3} />}
      </span>
    );

  if (!canManage || !target) {
    return (
      <span role="img" aria-label={label} className="block">
        {face}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="group block rounded-full"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set('id', id);
        fd.set('status', target);
        startTransition(async () => {
          try {
            const res = await setStatus({}, fd);
            if (res.ok) toast.success(res.message ?? 'Salvo.');
            else toast.error(res.error ?? 'Não foi possível salvar.');
          } catch {
            toast.error('Sem conexão. Tente de novo.');
          }
          router.refresh();
        });
      }}
    >
      {face}
    </button>
  );
}
