import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { ForcedPasswordForm } from './PasswordForms';

export const metadata: Metadata = { title: 'Criar nova senha' };
export const dynamic = 'force-dynamic';

export default async function TrocarSenhaPage() {
  const access = await getAccess();
  if (!access) redirect('/sair?motivo=sessao');
  if (!access.mustChangePassword) redirect('/inicio');
  return (
    <AuthFrame title={`Olá, ${access.fullName.split(' ')[0]}`} subtitle="Crie uma senha pessoal para continuar. A senha temporária deixa de valer.">
      <ForcedPasswordForm />
      <form action="/sair" method="post" className="mt-4 text-center">
        <button type="submit" className="text-sm font-bold text-pedra-500 hover:underline">
          Sair
        </button>
      </form>
      <p className="sr-only">
        <Link href="/login">Login</Link>
      </p>
    </AuthFrame>
  );
}
