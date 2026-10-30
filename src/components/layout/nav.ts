import type { Access } from '@/lib/auth';
import { can, canAny, canSeeServidores, canSeeTeams } from '@/lib/auth';

export type NavIcon = 'inicio' | 'presenca' | 'camisetas' | 'cronograma' | 'equipes' | 'servidores' | 'encontristas' | 'grupos' | 'financeiro' | 'configuracoes' | 'usuarios' | 'auditoria';
export type NavItem = { href: string; label: string; icon: NavIcon; group: 'operacao' | 'admin' };

export function buildNav(access: Access): NavItem[] {
  const items: NavItem[] = [
    { href: '/inicio', label: 'Início', icon: 'inicio', group: 'operacao' },
    { href: '/cronograma', label: 'Cronograma', icon: 'cronograma', group: 'operacao' },
  ];
  if (can(access, 'encontristas.ver')) items.push({ href: '/encontristas', label: 'Recrutas', icon: 'encontristas', group: 'operacao' });
  // Quem só marca presença entra direto na aba Presença de Recrutas.
  else if (can(access, 'presenca.marcar')) items.push({ href: '/encontristas/presenca', label: 'Recrutas', icon: 'encontristas', group: 'operacao' });
  if (canAny(access, ['encontristas.ver', 'grupos.gerenciar'])) items.push({ href: '/grupos', label: 'Tropas', icon: 'grupos', group: 'operacao' });
  if (canSeeTeams(access)) items.push({ href: '/equipes', label: 'Equipes', icon: 'equipes', group: 'operacao' });
  if (canSeeServidores(access)) items.push({ href: '/servidores', label: 'Soldados/Servos', icon: 'servidores', group: 'operacao' });
  if (can(access, 'camisetas.ver')) items.push({ href: '/camisetas', label: 'Camisetas', icon: 'camisetas', group: 'operacao' });
  if (can(access, 'financeiro.gerenciar')) items.push({ href: '/financeiro', label: 'Financeiro', icon: 'financeiro', group: 'admin' });
  if (can(access, 'acampamento.gerenciar')) items.push({ href: '/configuracoes', label: 'Configurações', icon: 'configuracoes', group: 'admin' });
  if (can(access, 'usuarios.gerenciar')) items.push({ href: '/usuarios', label: 'Usuários', icon: 'usuarios', group: 'admin' });
  if (can(access, 'auditoria.ver')) items.push({ href: '/auditoria', label: 'Auditoria', icon: 'auditoria', group: 'admin' });
  return items;
}

// Módulos da tela inicial: tudo do menu, menos o próprio Início.
export function buildModules(access: Access) {
  return buildNav(access).filter((i) => i.href !== '/inicio');
}
