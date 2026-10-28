import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Panel, Badge, DataList, Notice } from '@/components/ui/layout';
import { formatDateTime } from '@/lib/format';
import { EditUserForm } from '../UserForm';
import { loadRolesAndPerms } from '../data';
import { UserAdminActions } from './UserAdminActions';

export const metadata: Metadata = { title: 'Usuário' };

export default async function UsuarioPage({ params }: { params: { id: string } }) {
  const access = await requirePerm('usuarios.gerenciar');
  const supabase = createClient();
  const { data: user } = await supabase
    .from('profiles')
    .select('id, username, full_name, phone, active, must_change_password, created_at, user_roles!user_roles_user_id_fkey(role_key), user_permissions!user_permissions_user_id_fkey(permission_key)')
    .eq('id', params.id)
    .maybeSingle();
  if (!user) notFound();

  const [{ roles, perms }, { data: teams }, { data: canManage }] = await Promise.all([
    loadRolesAndPerms(),
    supabase.from('service_team_coordinators').select('team:service_teams(id, name)').eq('user_id', user.id),
    supabase.rpc('can_manage_user', { p_user: user.id }),
  ]);
  const roleKeys = (user.user_roles as { role_key: string }[]).map((r) => r.role_key);
  const permKeys = (user.user_permissions as { permission_key: string }[]).map((p) => p.permission_key);
  const coordTeams = (teams ?? []).map((t) => t.team as unknown as { id: string; name: string } | null).filter(Boolean) as { id: string; name: string }[];

  return (
    <>
      <PageHeader
        title={user.full_name}
        description={`@${user.username}`}
        back={{ href: '/usuarios', label: 'Usuários' }}
        actions={!user.active ? <Badge tone="erro">Desativado</Badge> : user.must_change_password ? <Badge>Aguardando 1º acesso</Badge> : null}
      />
      {!canManage ? (
        <Notice tone="aviso" className="mb-5">
          Este usuário é administrador. Apenas outro administrador pode alterá-lo.
        </Notice>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Panel>
          {canManage ? (
            <EditUserForm
              user={user}
              roles={roles}
              perms={perms}
              selectedRoles={roleKeys}
              selectedPerms={permKeys}
              canGrantAdmin={access.isAdmin}
            />
          ) : (
            <DataList items={[{ label: 'Nome', value: user.full_name }, { label: 'Usuário', value: `@${user.username}` }]} />
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Equipes que coordena">
            {coordTeams.length ? (
              <ul className="space-y-1">
                {coordTeams.map((t) => (
                  <li key={t.id}>
                    <Link href={`/equipes/${t.id}`} className="text-sm font-bold text-manto hover:underline">
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-pedra-500">Nenhuma. O vínculo é feito na página de cada equipe.</p>
            )}
          </Panel>
          {canManage ? (
            <Panel title="Acesso">
              <UserAdminActions id={user.id} active={user.active} isSelf={user.id === access.userId} />
            </Panel>
          ) : null}
          <p className="px-1 text-xs text-pedra-500">Criado em {formatDateTime(user.created_at)}</p>
        </div>
      </div>
    </>
  );
}
