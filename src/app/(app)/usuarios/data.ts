import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PermOption, RoleOption } from './UserForm';

// Nomenclatura do HOLY CAMP aplicada sobre os textos gravados no banco.
const PERM_TEXT: Record<string, { name: string; description: string; module?: string }> = {
  'servidores.ver_todos': { name: 'Ver todos os soldados/servos', description: 'Consultar soldados/servos de todas as equipes.' },
  'servidores.editar_todos': { name: 'Editar todos os soldados/servos', description: 'Cadastrar e editar soldados/servos de qualquer equipe.' },
  'encontristas.ver': { name: 'Ver recrutas', description: 'Consultar a lista e as fichas dos recrutas.', module: 'Recrutas' },
  'encontristas.editar': { name: 'Cadastrar recrutas', description: 'Cadastrar e editar fichas de recrutas.', module: 'Recrutas' },
  'saude.ver': { name: 'Ver informações de saúde', description: 'Consultar alergias, medicamentos e observações de saúde dos recrutas. Cada acesso é registrado.', module: 'Recrutas' },
  'grupos.gerenciar': { name: 'Gerenciar tropas', description: 'Criar tropas e distribuir ou realocar recrutas.', module: 'Recrutas' },
};
const ROLE_TEXT: Record<string, string> = {
  coord_geral: 'Gerencia equipes, soldados/servos, recrutas e tropas. Financeiro só com permissão explícita.',
};

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
      description: ROLE_TEXT[r.key as string] ?? r.description,
      includes: (rp ?? []).filter((x) => x.role_key === r.key).map((x) => x.permission_key as string),
    })) as RoleOption[],
    perms: (perms ?? []).map((p) => ({ ...p, ...(PERM_TEXT[p.key as string] ?? {}) })) as PermOption[],
  };
}
