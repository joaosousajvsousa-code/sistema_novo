import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { requireAccess } from '@/lib/auth';
import { getActiveCamp } from '@/lib/camp';
import { buildNav } from '@/components/layout/nav';
import { MobileNav, SidebarNav } from '@/components/layout/NavLinks';
import { LogoMark } from '@/components/Logo';
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
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col overflow-hidden bg-manto-800 lg:flex">
        {/* mesmo acabamento do login: mapa topográfico, luz dourada e faixa listrada na borda */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/textura-topografica.svg')] bg-cover bg-center opacity-80" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(200,161,101,0.25),transparent_45%),linear-gradient(to_bottom,transparent_60%,rgba(10,14,6,0.45))]" />
        <div aria-hidden className="absolute inset-y-0 right-0 w-1 bg-[repeating-linear-gradient(45deg,#C8A165_0_10px,#252E1A_10px_20px)] opacity-80" />

        <div className="relative flex justify-center px-5 pb-1 pt-4 [@media(max-height:860px)]:pt-3">
          <Link href="/inicio" aria-label="Ir para o início" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cirio">
            <LogoMark height={136} priority className="h-[136px] w-auto drop-shadow-[0_10px_22px_rgba(0,0,0,0.45)] [@media(max-height:860px)]:h-24" />
          </Link>
        </div>
        <SidebarNav items={nav} />
        <div className="relative px-3 pb-3 pt-2">
          <div className="flex items-center gap-2.5 rounded-xl bg-black/25 p-2 ring-1 ring-white/10 backdrop-blur-sm">
            <Link href="/conta" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 hover:bg-white/5" title="Minha conta">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cirio text-xs font-bold text-manto-800">
                {access.fullName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join('')}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight text-white">{access.fullName}</span>
                <span className="flex items-center gap-1 truncate text-[11px] text-manto-100/60">
                  <KeyRound className="h-3 w-3" aria-hidden /> Minha conta
                </span>
              </span>
            </Link>
            <form action="/sair" method="post">
              <button type="submit" aria-label="Sair" title="Sair" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-manto-100/90 ring-1 ring-white/10 hover:bg-erro/80 hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-pedra-200 bg-white/90 backdrop-blur-md">
        <div aria-hidden className="h-1 bg-[repeating-linear-gradient(135deg,#C8A165_0_10px,#3D4A2A_10px_20px)]" />
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/inicio" className="lg:hidden" aria-label="Ir para o início">
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
