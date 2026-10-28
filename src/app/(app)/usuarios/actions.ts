'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { done, fail, fromZod, type ActionState } from '@/lib/action';
import { friendlyError } from '@/lib/errors';
import { phoneOptional, requiredText, uuid } from '@/lib/validation';
import { generateTempPassword } from '@/lib/password';
import { normalizeUsername, USERNAME_PATTERN, usernameToEmail } from '@/config/app';

const ROLES = ['admin', 'coord_geral', 'coord_equipe', 'voluntario'] as const;

const baseSchema = z.object({
  full_name: requiredText('o nome', 2, 120),
  phone: phoneOptional,
});

const createSchema = baseSchema.extend({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(USERNAME_PATTERN, 'Use de 3 a 32 letras minúsculas, números, ponto, hífen ou sublinhado. Comece com letra ou número.')),
  temp_password: z.string().min(8, 'A senha temporária precisa ter pelo menos 8 caracteres.').max(72),
});

function readList(fd: FormData, key: string) {
  return fd.getAll(key).map(String).filter(Boolean);
}

async function validPermissionKeys(keys: string[]) {
  if (!keys.length) return [];
  const supabase = createClient();
  const { data } = await supabase.from('permissions').select('key').in('key', keys);
  return (data ?? []).map((p) => p.key as string);
}

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('usuarios.gerenciar');
  if (!adminConfigured()) return fail('A chave SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.');
  const parsed = createSchema.safeParse({
    full_name: fd.get('full_name'),
    phone: fd.get('phone') ?? '',
    username: fd.get('username') ?? '',
    temp_password: fd.get('temp_password') ?? '',
  });
  if (!parsed.success) return fromZod(parsed.error);
  const roles = readList(fd, 'roles').filter((r): r is (typeof ROLES)[number] => (ROLES as readonly string[]).includes(r));
  if (!roles.length) return fail('Confira os campos destacados.', { roles: 'Escolha pelo menos um perfil.' });
  if (roles.includes('admin') && !access.isAdmin) return fail('Apenas administradores podem criar outro administrador.');
  const perms = await validPermissionKeys(readList(fd, 'permissions'));

  const admin = createAdminClient();
  const { data: existing } = await admin.from('profiles').select('id').eq('username', parsed.data.username).maybeSingle();
  if (existing) return fail('Confira os campos destacados.', { username: 'Este nome de usuário já está em uso.' });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(parsed.data.username),
    password: parsed.data.temp_password,
    email_confirm: true,
    user_metadata: { username: parsed.data.username },
  });
  if (createError || !created.user) {
    if (createError?.message?.toLowerCase().includes('already')) {
      return fail('Confira os campos destacados.', { username: 'Este nome de usuário já está em uso.' });
    }
    return fail('Não foi possível criar o usuário no serviço de autenticação.');
  }
  const userId = created.user.id;

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    username: parsed.data.username,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    must_change_password: true,
    created_by: access.userId,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return fail(friendlyError(profileError, 'Não foi possível criar o perfil. Nada foi salvo.'));
  }

  // Perfis e permissões gravados com a sessão de quem está criando: a RLS confere.
  const supabase = createClient();
  const { error: rolesError } = await supabase
    .from('user_roles')
    .insert(roles.map((role_key) => ({ user_id: userId, role_key, created_by: access.userId })));
  const { error: permsError } = perms.length
    ? await supabase.from('user_permissions').insert(perms.map((permission_key) => ({ user_id: userId, permission_key, created_by: access.userId })))
    : { error: null };
  if (rolesError || permsError) {
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    return fail(friendlyError(rolesError ?? permsError, 'Não foi possível salvar as permissões. Nada foi salvo.'));
  }

  revalidatePath('/usuarios');
  return done('Usuário criado.', { userId, username: parsed.data.username, password: parsed.data.temp_password });
}

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('usuarios.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Usuário inválido.');
  const parsed = baseSchema.safeParse({ full_name: fd.get('full_name'), phone: fd.get('phone') ?? '' });
  if (!parsed.success) return fromZod(parsed.error);
  const roles = readList(fd, 'roles').filter((r) => (ROLES as readonly string[]).includes(r));
  if (!roles.length) return fail('Confira os campos destacados.', { roles: 'Escolha pelo menos um perfil.' });
  const perms = await validPermissionKeys(readList(fd, 'permissions'));

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone })
    .eq('id', id.data)
    .select('id');
  if (error) return fail(friendlyError(error));
  if (!updated?.length) return fail('Você não tem permissão para alterar este usuário.');

  const [{ data: curRoles }, { data: curPerms }] = await Promise.all([
    supabase.from('user_roles').select('role_key').eq('user_id', id.data),
    supabase.from('user_permissions').select('permission_key').eq('user_id', id.data),
  ]);
  const haveRoles = new Set((curRoles ?? []).map((r) => r.role_key as string));
  const havePerms = new Set((curPerms ?? []).map((p) => p.permission_key as string));
  const addRoles = roles.filter((r) => !haveRoles.has(r));
  const delRoles = Array.from(haveRoles).filter((r) => !roles.includes(r));
  const addPerms = perms.filter((p) => !havePerms.has(p));
  const delPerms = Array.from(havePerms).filter((p) => !perms.includes(p));
  if ((addRoles.includes('admin') || delRoles.includes('admin')) && !access.isAdmin) {
    return fail('Apenas administradores podem conceder ou retirar o perfil de administrador.');
  }

  if (addRoles.length) {
    const { error: e } = await supabase.from('user_roles').insert(addRoles.map((role_key) => ({ user_id: id.data, role_key, created_by: access.userId })));
    if (e) return fail(friendlyError(e));
  }
  if (delRoles.length) {
    const { error: e } = await supabase.from('user_roles').delete().eq('user_id', id.data).in('role_key', delRoles);
    if (e) return fail(friendlyError(e));
  }
  if (addPerms.length) {
    const { error: e } = await supabase
      .from('user_permissions')
      .insert(addPerms.map((permission_key) => ({ user_id: id.data, permission_key, created_by: access.userId })));
    if (e) return fail(friendlyError(e));
  }
  if (delPerms.length) {
    const { error: e } = await supabase.from('user_permissions').delete().eq('user_id', id.data).in('permission_key', delPerms);
    if (e) return fail(friendlyError(e));
  }
  revalidatePath(`/usuarios/${id.data}`);
  revalidatePath('/usuarios');
  return done('Alterações salvas.');
}

export async function setUserActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('usuarios.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Usuário inválido.');
  const active = fd.get('active') === 'true';
  if (!active && id.data === access.userId) return fail('Você não pode desativar o seu próprio acesso.');
  if (!adminConfigured()) return fail('A chave SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.');

  const supabase = createClient();
  const { data: updated, error } = await supabase.from('profiles').update({ active }).eq('id', id.data).select('id');
  if (error) return fail(friendlyError(error));
  if (!updated?.length) return fail('Você não tem permissão para alterar este usuário.');

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(id.data, { ban_duration: active ? 'none' : '876000h' });
  if (!active) {
    await supabase.rpc('revoke_user_sessions', { p_user: id.data });
  }
  revalidatePath(`/usuarios/${id.data}`);
  revalidatePath('/usuarios');
  if (banError) return done(active ? 'Usuário reativado, mas o login pode continuar bloqueado. Tente de novo.' : 'Acesso desativado no sistema.');
  return done(active ? 'Usuário reativado.' : 'Usuário desativado e desconectado.');
}

export async function resetUserPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const access = await requirePerm('usuarios.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Usuário inválido.');
  if (id.data === access.userId) return fail('Para trocar a sua própria senha, use Minha conta.');
  if (!adminConfigured()) return fail('A chave SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.');

  // Confere a permissão no banco antes de usar a chave de serviço.
  const supabase = createClient();
  const { data: allowed } = await supabase.rpc('can_manage_user', { p_user: id.data });
  if (!allowed) return fail('Você não tem permissão para alterar este usuário.');

  const password = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id.data, { password });
  if (error) return fail('Não foi possível redefinir a senha. Tente de novo.');
  await supabase.from('profiles').update({ must_change_password: true }).eq('id', id.data);
  await supabase.rpc('revoke_user_sessions', { p_user: id.data });
  revalidatePath(`/usuarios/${id.data}`);
  return done('Senha redefinida.', { password });
}

export async function revokeSessions(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePerm('usuarios.gerenciar');
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return fail('Usuário inválido.');
  const supabase = createClient();
  const { error } = await supabase.rpc('revoke_user_sessions', { p_user: id.data });
  if (error) return fail(friendlyError(error, 'Não foi possível encerrar as sessões.'));
  return done('Sessões encerradas. O usuário precisará entrar de novo.');
}
