'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserRound,
  Shapes,
  Tent,
  ShieldCheck,
  ScrollText,
  HandHeart,
  MoreHorizontal,
  X,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NavIcon, NavItem } from './nav';

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  painel: LayoutDashboard,
  encontristas: UserRound,
  grupos: Shapes,
  equipes: HandHeart,
  servidores: Users,
  acampamento: Tent,
  usuarios: ShieldCheck,
  auditoria: ScrollText,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups: { key: NavItem['group']; label?: string }[] = [{ key: 'operacao' }, { key: 'admin', label: 'Administração' }];
  return (
    <nav aria-label="Principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key}>
            {g.label ? <p className="mb-1 px-3 text-xs text-manto-100/60">{g.label}</p> : null}
            <ul className="space-y-0.5">
              {list.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors',
                        active ? 'bg-white/10 text-white' : 'text-manto-100/80 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {active ? <span className="absolute left-0 top-2 h-6 w-0.5 rounded bg-cirio" aria-hidden /> : null}
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items, userName }: { items: NavItem[]; userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const primary = items.slice(0, 4);
  const rest = items.slice(4);

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <nav
        aria-label="Principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-pedra-200 bg-white lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold',
                    active ? 'text-manto' : 'text-pedra-500',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'text-manto')} />
                  {item.label}
                  <span className={cn('h-0.5 w-5 rounded', active ? 'bg-cirio' : 'bg-transparent')} aria-hidden />
                </Link>
              </li>
            );
          })}
          <li className={cn(primary.length < 4 && 'col-start-5')}>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="menu-mais"
              className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-bold text-pedra-500"
            >
              <MoreHorizontal className="h-5 w-5" />
              Mais
              <span className="h-0.5 w-5" aria-hidden />
            </button>
          </li>
        </ul>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Mais opções" id="menu-mais">
          <button type="button" className="absolute inset-0 bg-pedra-900/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-lg bg-white p-4 shadow-[0_-8px_30px_rgba(21,32,46,0.18)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-pedra-500">
                Conectado como <span className="font-bold text-pedra-900">{userName}</span>
              </p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-pedra-500" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="divide-y divide-pedra-100">
              {rest.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link href={item.href} className="flex h-12 items-center gap-3 text-base font-bold text-pedra-900">
                      <Icon className="h-5 w-5 text-manto" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/conta" className="flex h-12 items-center gap-3 text-base font-bold text-pedra-900">
                  <KeyRound className="h-5 w-5 text-manto" />
                  Minha conta e senha
                </Link>
              </li>
              <li>
                <form action="/sair" method="post">
                  <button type="submit" className="flex h-12 w-full items-center gap-3 text-base font-bold text-erro">
                    <LogOut className="h-5 w-5" />
                    Sair
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
