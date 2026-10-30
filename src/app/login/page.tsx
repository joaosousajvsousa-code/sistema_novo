import type { Metadata } from 'next';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { Notice } from '@/components/ui/layout';
import { supabaseConfigured } from '@/lib/env';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

const MOTIVOS: Record<string, string> = {
  sessao: 'Sua sessão terminou ou o acesso foi desativado. Entre novamente.',
  senha: 'Senha alterada. Entre com a nova senha.',
  admin: 'Administrador criado. Entre com o usuário e a senha que você acabou de definir.',
};

export default function LoginPage({ searchParams }: { searchParams: { voltar?: string; motivo?: string } }) {
  const motivo = searchParams.motivo ? MOTIVOS[searchParams.motivo] : null;
  return (
    <AuthFrame>
      {!supabaseConfigured() ? (
        <Notice tone="aviso" title="Sistema ainda não configurado">
          Faltam as variáveis do Supabase (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY). Veja o passo a passo no README do projeto.
        </Notice>
      ) : (
        <>
          {motivo ? <Notice className="mb-4">{motivo}</Notice> : null}
          <LoginForm voltar={searchParams.voltar ?? null} />
        </>
      )}
    </AuthFrame>
  );
}
