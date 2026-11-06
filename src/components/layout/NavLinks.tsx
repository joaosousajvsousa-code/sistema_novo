'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HeartPulse,
  House,
  ClipboardCheck,
  Shirt,
  CalendarClock,
  Users,
  UserRound,
  Shapes,
  Settings,
  Wallet,
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

export const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  inicio: House,
  presenca: ClipboardCheck,
  saude: HeartPulse,
  camisetas: Shirt,
  cronograma: CalendarClock,
  encontristas: UserRound,
  grupos: Shapes,
  equipes: HandHeart,
  servidores: Users,
  configuracoes: Settings,
  financeiro: Wallet,
  usuarios: ShieldCheck,
  auditoria: ScrollText,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups: { key: NavItem['group']; label: string }[] = [
    { key: 'operacao', label: 'Operação' },
    { key: 'admin', label: 'Administração' },
  ];
  return (
    <nav aria-label="Principal" className="relative flex-1 space-y-4 overflow-y-auto px-3 pb-2 pt-2 [scrollbar-width:thin] [@media(max-height:860px)]:space-y-2.5">
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key}>
            <p className="mb-1.5 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cirio/80">
              {g.label}
              <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-cirio/40 to-transparent" />
            </p>
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
                        'group relative flex h-10 items-center gap-3 rounded-xl px-2 text-sm font-bold transition-all [@media(max-height:860px)]:h-9',
                        active
                          ? 'bg-gradient-to-r from-cirio/25 via-white/10 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(200,161,101,0.35)]'
                          : 'text-manto-100/80 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors [@media(max-height:860px)]:h-7 [@media(max-height:860px)]:w-7',
                          active ? 'bg-cirio text-manto-800 shadow-[0_6px_14px_-6px_rgba(200,161,101,0.9)]' : 'bg-white/[0.06] text-manto-100/80 group-hover:bg-white/10 group-hover:text-white',
                        )}
                      >
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="truncate">{item.label}</span>
                      {active ? <span aria-hidden className="ml-auto mr-1 h-1.5 w-1.5 rounded-full bg-cirio" /> : null}
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

// Tela inicial: um card por módulo que a pessoa pode acessar.
export function ModuleCards({ items }: { items: NavItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const highlight = item.icon === 'cronograma';
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex h-full min-h-[124px] flex-col justify-between rounded-[14px] border border-pedra-200 bg-white p-4 shadow-[0_1px_2px_rgba(21,32,46,0.06)] transition-colors hover:border-manto/40 active:bg-pedra-100 sm:min-h-[150px] sm:p-5"
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl sm:h-[52px] sm:w-[52px]',
                  highlight ? 'bg-cirio-50 text-cirio-700' : 'bg-manto-50 text-manto',
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="mt-4 text-base font-bold leading-tight text-pedra-900 sm:text-lg">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
