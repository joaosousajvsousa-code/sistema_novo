import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PermOption, RoleOption } from './UserForm';

export async function loadRolesAndPerms(): Promise<{ roles: RoleOption[]; perms: PermOption[] }> {
  const supabase = createClient();
  const [{ data: roles }, { data: perms }, { data: rp }] = await Promise.all([
    supabase.from('roles').select('key, name, description').order('sort'),
    supabase.from('permissions').select('key, name, description, module').order('sort'),
    supabase.from('role_permissions').select('role_key, permission_key'),
  ]);
  return {
    roles: (roles ?? []).map((r) => ({
      ...r,
      includes: (rp ?? []).filter((x) => x.role_key === r.key).map((x) => x.permission_key as string),
    })) as RoleOption[],
    perms: (perms ?? []) as PermOption[],
  };
}
