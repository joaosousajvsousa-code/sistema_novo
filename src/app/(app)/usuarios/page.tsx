import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, UserPlus } from 'lucide-react';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Badge, EmptyState, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROLE_LABEL } from '@/lib/labels';
import { adminConfigured } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Usuários' };

export default async function UsuariosPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePerm('usuarios.gerenciar');
  const supabase = createClient();
  const q = (searchParams.q ?? '').trim();
  let query = supabase
    .from('profiles')
    .select('id, username, full_name, active, must_change_password, user_roles!user_roles_user_id_fkey(role_key)')
    .order('active', { ascending: false })
    .order('full_name');
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, '')}%,username.ilike.%${q.replace(/[%,()]/g, '')}%`);
  const { data: users, error } = await query;

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Quem acessa o sistema e com qual perfil."
        actions={
          <ButtonLink href="/usuarios/novo">
            <UserPlus className="h-4 w-4" /> Novo usuário
          </ButtonLink>
        }
      />
      {!adminConfigured() ? (
        <Notice tone="aviso" className="mb-4">
          A chave SUPABASE_SERVICE_ROLE_KEY não está configurada: não será possível criar, desativar ou redefinir senhas.
        </Notice>
      ) : null}
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Buscar usuário
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder="Buscar por nome ou usuário" type="search" />
        <button className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-md border border-pedra-300 bg-white text-manto" aria-label="Buscar">
          <Search className="h-5 w-5" />
        </button>
      </form>
      <div className="rounded-lg border border-pedra-200 bg-white">
        {error ? (
          <EmptyState title="Não foi possível carregar os usuários" description="Verifique a conexão e recarregue a página." />
        ) : !users?.length ? (
          <EmptyState title={q ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'} />
        ) : (
          <ul className="divide-y divide-pedra-100">
            {users.map((u) => (
              <li key={u.id}>
                <Link href={`/usuarios/${u.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-pedra-100/60 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{u.full_name}</p>
                    <p className="text-xs text-pedra-500">@{u.username}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(u.user_roles as { role_key: string }[]).map((r) => (
                      <Badge key={r.role_key} tone={r.role_key === 'admin' ? 'cirio' : 'manto'}>
                        {ROLE_LABEL[r.role_key] ?? r.role_key}
                      </Badge>
                    ))}
                    {!u.active ? <Badge tone="erro">Desativado</Badge> : u.must_change_password ? <Badge>Aguardando 1º acesso</Badge> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
