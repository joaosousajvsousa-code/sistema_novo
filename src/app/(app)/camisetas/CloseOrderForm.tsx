'use client';

import { useRouter } from 'next/navigation';
import { ActionForm, Field, SubmitButton } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { closeOrder } from './actions';

export function CloseOrderForm() {
  const router = useRouter();
  return (
    <ActionForm action={closeOrder} resetOnSuccess onSuccess={() => router.refresh()} className="space-y-3">
      <Field label="Observação (opcional)" name="note" hint="Ex.: enviado para a gráfica no dia 05/11.">
        <Input maxLength={500} />
      </Field>
      <SubmitButton confirmMessage="Fechar o pedido com os totais de agora? Isso cria uma nova versão.">Fechar pedido</SubmitButton>
    </ActionForm>
  );
}
