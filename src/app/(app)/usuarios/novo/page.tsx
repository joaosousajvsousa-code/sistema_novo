import type { Metadata } from 'next';
import { requirePerm } from '@/lib/auth';
import { PageHeader, Panel } from '@/components/ui/layout';
import { generateTempPassword } from '@/lib/password';
import { NewUserForm } from '../UserForm';
import { loadRolesAndPerms } from '../data';

export const metadata: Metadata = { title: 'Novo usuário' };

export default async function NovoUsuarioPage() {
  const access = await requirePerm('usuarios.gerenciar');
  const { roles, perms } = await loadRolesAndPerms();
  return (
    <>
      <PageHeader title="Novo usuário" back={{ href: '/usuarios', label: 'Usuários' }} />
      <Panel>
        <NewUserForm roles={roles} perms={perms} canGrantAdmin={access.isAdmin} suggestedPassword={generateTempPassword()} />
      </Panel>
    </>
  );
}
