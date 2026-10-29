'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { FileField } from '@/components/FileField';
import { useFieldError } from '@/components/ui/form';
import { toInputBRL } from '@/lib/money';
import { changePaymentStatus, savePayment } from './payment-actions';

export type PaymentData = {
  id: string;
  payment_expected: number | null;
  payment_paid: number | null;
  payment_date: string | null;
  payment_method: string | null;
  payment_notes: string | null;
};

function FileWithError() {
  const error = useFieldError('file');
  return (
    <div className="sm:col-span-2">
      <FileField />
      {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
    </div>
  );
}

export function PaymentForm({ data }: { data: PaymentData }) {
  const router = useRouter();
  return (
    <ActionForm action={savePayment} onSuccess={() => router.refresh()} className="space-y-4">
      <input type="hidden" name="id" value={data.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor combinado (R$)" name="expected" hint="Quanto este soldado/servo deve pagar.">
          <Input inputMode="decimal" defaultValue={toInputBRL(data.payment_expected)} placeholder="0,00" />
        </Field>
        <Field label="Valor pago (R$)" name="paid">
          <Input inputMode="decimal" defaultValue={toInputBRL(data.payment_paid)} placeholder="0,00" />
        </Field>
        <Field label="Data do pagamento" name="date">
          <DateInput defaultValue={data.payment_date ?? ''} />
        </Field>
        <Field label="Forma de pagamento" name="method">
          <Select defaultValue={data.payment_method ?? ''}>
            <option value="">Não informada</option>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
            <option value="transferencia">Transferência</option>
            <option value="outro">Outro</option>
          </Select>
        </Field>
        <Field label="Observações" name="notes" className="sm:col-span-2">
          <Textarea rows={2} defaultValue={data.payment_notes ?? ''} />
        </Field>
        <FileWithError />
      </div>
      <SubmitButton>Salvar pagamento</SubmitButton>
      <p className="text-xs text-pedra-500">Salvar não confirma o pagamento: ele fica aguardando a conferência do financeiro.</p>
    </ActionForm>
  );
}

// A ação pode tirar o pagamento da lista na hora; por isso o aviso é
// disparado aqui, sem depender do formulário continuar na tela.
function StatusAction({ id, status, label, variant, confirm }: { id: string; status: string; label: string; variant: 'primary' | 'secondary' | 'quiet-danger' | 'ghost'; confirm?: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      aria-busy={pending || undefined}
      className={variant === 'quiet-danger' ? 'border border-erro/30' : undefined}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData();
        fd.set('id', id);
        fd.set('status', status);
        startTransition(async () => {
          try {
            const res = await changePaymentStatus({}, fd);
            if (res.ok) toast.success(res.message ?? 'Salvo.');
            else toast.error(res.error ?? 'Não foi possível salvar.');
          } catch {
            toast.error('Sem conexão. Tente de novo.');
          }
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

export function PaymentReview({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'confirmado' && status !== 'estornado' ? (
        <StatusAction id={id} status="confirmado" label="Confirmar pagamento" variant="primary" confirm="Confirmar este pagamento? O valor entra nas receitas." />
      ) : null}
      {status !== 'isento' && status !== 'confirmado' ? <StatusAction id={id} status="isento" label="Marcar como isento" variant="secondary" /> : null}
      {status === 'confirmado' ? (
        <StatusAction id={id} status="estornado" label="Estornar" variant="quiet-danger" confirm="Estornar este pagamento? O valor sai das receitas." />
      ) : null}
      {status !== 'pendente' ? <StatusAction id={id} status="pendente" label="Voltar para pendente" variant="ghost" /> : null}
    </div>
  );
}
