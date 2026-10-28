import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthFrame } from '@/components/auth/AuthFrame';

export const metadata: Metadata = { title: 'Recuperar acesso' };

export default function EsqueciSenhaPage() {
  return (
    <AuthFrame title="Recuperar acesso" subtitle="O acesso é feito por nome de usuário, sem e-mail. Por segurança, a senha é redefinida pela administração.">
      <ol className="list-decimal space-y-3 pl-5 text-sm text-pedra-700">
        <li>Fale com um administrador do sistema e informe o seu nome de usuário.</li>
        <li>Ele vai gerar uma senha temporária para você.</li>
        <li>Entre com essa senha. O sistema vai pedir que você crie uma nova senha pessoal logo no primeiro acesso.</li>
      </ol>
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-bold text-manto hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthFrame>
  );
}
