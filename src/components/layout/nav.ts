import type { Access } from '@/lib/auth';
import { can, canAny, canSeeServidores, canSeeTeams } from '@/lib/auth';

export type NavIcon = 'painel' | 'cronograma' | 'equipes' | 'servidores' | 'encontristas' | 'grupos' | 'configuracoes' | 'usuarios' | 'auditoria';
export type NavItem = { href: string; label: string; icon: NavIcon; group: 'operacao' | 'admin' };

export function buildNav(access: Access): NavItem[] {
  const items: NavItem[] = [
    { href: '/painel', label: 'Painel', icon: 'painel', group: 'operacao' },
    { href: '/cronograma', label: 'Cronograma', icon: 'cronograma', group: 'operacao' },
  ];
  if (can(access, 'encontristas.ver')) items.push({ href: '/encontristas', label: 'Recrutas', icon: 'encontristas', group: 'operacao' });
  if (canAny(access, ['encontristas.ver', 'grupos.gerenciar'])) items.push({ href: '/grupos', label: 'Tropas', icon: 'grupos', group: 'operacao' });
  if (canSeeTeams(access)) items.push({ href: '/equipes', label: 'Equipes', icon: 'equipes', group: 'operacao' });
  if (canSeeServidores(access)) items.push({ href: '/servidores', label: 'Soldados/Servos', icon: 'servidores', group: 'operacao' });
  if (can(access, 'acampamento.gerenciar')) items.push({ href: '/configuracoes', label: 'Configurações', icon: 'configuracoes', group: 'admin' });
  if (can(access, 'usuarios.gerenciar')) items.push({ href: '/usuarios', label: 'Usuários', icon: 'usuarios', group: 'admin' });
  if (can(access, 'auditoria.ver')) items.push({ href: '/auditoria', label: 'Auditoria', icon: 'auditoria', group: 'admin' });
  return items;
}
