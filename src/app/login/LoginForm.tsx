'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { normalizeUsername, USERNAME_PATTERN, usernameToEmail } from '@/config/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/auth/PasswordInput';

function safeRedirect(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) return '/inicio';
  return path;
}

export function LoginForm({ voltar }: { voltar: string | null }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = normalizeUsername(String(fd.get('username') ?? ''));
    const password = String(fd.get('password') ?? '');
    setError(null);
    if (!username || !password) {
      setError('Informe o usuário e a senha.');
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setError('Usuário ou senha inválidos.');
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (authError) {
      setPending(false);
      if (authError.status === 429) setError('Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
      else if (authError.status && authError.status >= 500) setError('O serviço de login não respondeu. Tente de novo em instantes.');
      else if (authError.message?.toLowerCase().includes('fetch')) setError('Sem conexão com o servidor. Verifique a internet.');
      else setError('Usuário ou senha inválidos.');
      return;
    }
    router.replace(safeRedirect(voltar));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-md border border-erro/30 bg-erro-50 px-4 py-3 text-sm text-erro">
          {error}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-sm font-bold text-pedra-700">
          Usuário
        </label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-bold text-pedra-700">
          Senha
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entrando…
          </>
        ) : (
          'Entrar'
        )}
      </Button>
      <p className="text-center text-sm">
        <Link href="/esqueci-senha" className="font-bold text-manto hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
