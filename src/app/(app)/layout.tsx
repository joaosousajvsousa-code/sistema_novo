import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { requireAccess } from '@/lib/auth';
import { getActiveCamp } from '@/lib/camp';
import { buildNav } from '@/components/layout/nav';
import { MobileNav, SidebarNav } from '@/components/layout/NavLinks';
import { Logo, LogoMark } from '@/components/Logo';
import { Badge } from '@/components/ui/layout';
import { CAMP_STATUS } from '@/lib/labels';
import { formatDateRange } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  if (access.mustChangePassword) redirect('/trocar-senha');

  const camp = await getActiveCamp();
  const nav = buildNav(access);
  const status = camp ? CAMP_STATUS[camp.status] : null;
  const firstName = access.fullName.split(' ')[0];

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-manto lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/painel" aria-label="Ir para o painel">
            <Logo light />
          </Link>
        </div>
        <SidebarNav items={nav} />
        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 text-sm font-bold text-white">{access.fullName}</p>
          <p className="truncate px-3 text-xs text-manto-100/60">@{access.username}</p>
          <div className="mt-2 flex gap-1">
            <Link href="/conta" className="flex h-9 flex-1 items-center gap-2 rounded-md px-3 text-xs font-bold text-manto-100/80 hover:bg-white/5 hover:text-white">
              <KeyRound className="h-4 w-4" /> Minha conta
            </Link>
            <form action="/sair" method="post">
              <button type="submit" className="flex h-9 items-center gap-2 rounded-md px-3 text-xs font-bold text-manto-100/80 hover:bg-white/5 hover:text-white">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-pedra-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/painel" className="lg:hidden" aria-label="Ir para o painel">
            <LogoMark />
          </Link>
          <div className="min-w-0 flex-1">
            {camp ? (
              <>
                <p className="truncate text-sm font-bold leading-tight text-pedra-900 sm:text-base">{camp.name}</p>
                <p className="truncate text-xs text-pedra-500">{formatDateRange(camp.start_date, camp.end_date) || 'Datas a definir em Configurações'}</p>
              </>
            ) : (
              <p className="text-sm text-pedra-500">Nenhum acampamento ativo</p>
            )}
          </div>
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          <span className="hidden text-sm text-pedra-500 sm:inline lg:hidden">{firstName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8 lg:pb-12">{children}</main>

      <MobileNav items={nav} userName={access.fullName} />
    </div>
  );
}
