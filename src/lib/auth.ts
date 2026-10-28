import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Permission =
  | 'usuarios.gerenciar'
  | 'acampamento.gerenciar'
  | 'auditoria.ver'
  | 'equipes.gerenciar'
  | 'servidores.ver_todos'
  | 'servidores.editar_todos'
  | 'encontristas.ver'
  | 'encontristas.editar'
  | 'saude.ver'
  | 'grupos.gerenciar';

export type Access = {
  userId: string;
  username: string;
  fullName: string;
  mustChangePassword: boolean;
  isAdmin: boolean;
  roles: string[];
  permissions: string[];
  coordinatedTeamIds: string[];
};

type RawAccess = {
  user_id: string;
  username: string;
  full_name: string;
  must_change_password: boolean;
  is_admin: boolean;
  roles: string[];
  permissions: string[];
  coordinated_team_ids: string[];
};

// Lê as permissões direto do banco (função my_access). Nunca confia em
// nada enviado pelo navegador.
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_access');
  if (error || !data) return null;
  const raw = data as RawAccess;
  return {
    userId: raw.user_id,
    username: raw.username,
    fullName: raw.full_name,
    mustChangePassword: raw.must_change_password,
    isAdmin: raw.is_admin,
    roles: raw.roles ?? [],
    permissions: raw.permissions ?? [],
    coordinatedTeamIds: raw.coordinated_team_ids ?? [],
  };
});

export function can(access: Access | null, perm: Permission) {
  if (!access) return false;
  return access.isAdmin || access.permissions.includes(perm);
}

export function canAny(access: Access | null, perms: Permission[]) {
  return perms.some((p) => can(access, p));
}

export function coordinatesTeam(access: Access | null, teamId: string) {
  return Boolean(access?.coordinatedTeamIds.includes(teamId));
}

export function canSeeTeams(access: Access | null) {
  return canAny(access, ['equipes.gerenciar', 'servidores.ver_todos']) || (access?.coordinatedTeamIds.length ?? 0) > 0;
}

export function canSeeServidores(access: Access | null) {
  return can(access, 'servidores.ver_todos') || (access?.coordinatedTeamIds.length ?? 0) > 0;
}

export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect('/sair?motivo=sessao');
  return access;
}

export async function requirePerm(...perms: Permission[]): Promise<Access> {
  const access = await requireAccess();
  if (!canAny(access, perms)) redirect('/sem-permissao');
  return access;
}

export async function requireCheck(check: (a: Access) => boolean): Promise<Access> {
  const access = await requireAccess();
  if (!check(access)) redirect('/sem-permissao');
  return access;
}
