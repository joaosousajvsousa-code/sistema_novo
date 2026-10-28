import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { Notice } from '@/components/ui/layout';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { FirstAdminForm } from './FirstAdminForm';

export const metadata: Metadata = { title: 'Primeiro acesso' };
export const dynamic = 'force-dynamic';

export default async function PrimeiroAcessoPage() {
  const enabled = supabaseConfigured() && adminConfigured() && (process.env.INITIAL_SETUP_CODE ?? '').length >= 8;
  let alreadyDone = false;
  let dbError = false;
  if (enabled) {
    const { count, error } = await createAdminClient().from('profiles').select('id', { count: 'exact', head: true });
    dbError = Boolean(error);
    alreadyDone = (count ?? 0) > 0;
  }

  return (
    <AuthFrame title="Primeiro acesso" subtitle="Crie o administrador do sistema. Esta tela só funciona enquanto não existe nenhum usuário.">
      {!enabled ? (
        <Notice tone="aviso" title="Configuração inicial desabilitada">
          Cadastre na hospedagem as variáveis do Supabase, SUPABASE_SERVICE_ROLE_KEY e INITIAL_SETUP_CODE (mínimo de 8 caracteres).
        </Notice>
      ) : dbError ? (
        <Notice tone="erro" title="Banco de dados não encontrado">
          Rode a migração <strong>supabase/migrations/0001_fundacao.sql</strong> no SQL Editor do Supabase e recarregue esta página.
        </Notice>
      ) : alreadyDone ? (
        <Notice title="O sistema já foi configurado">
          <Link href="/login" className="font-bold underline">
            Ir para o login
          </Link>
        </Notice>
      ) : (
        <FirstAdminForm />
      )}
    </AuthFrame>
  );
}
