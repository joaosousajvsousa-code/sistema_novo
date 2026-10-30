import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { requireAccess } from '@/lib/auth';
import { getActiveCamp } from '@/lib/camp';
import { buildModules } from '@/components/layout/nav';
import { ModuleCards } from '@/components/layout/NavLinks';
import { Logo } from '@/components/Logo';
import { TIME_ZONE } from '@/config/app';

export const metadata: Metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default async function InicioPage() {
  const access = await requireAccess();
  if (access.mustChangePassword) redirect('/trocar-senha');
  const camp = await getActiveCamp();
  const modules = buildModules(access);
  const today = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="min-h-dvh bg-pedra">
      <header className="bg-manto pb-16 pt-5 text-white sm:pb-20 sm:pt-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo light height={56} />
          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-md px-3 text-sm font-bold text-manto-100 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              {access.fullName.split(' ')[0]} <span aria-hidden>▾</span>
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-md border border-pedra-200 bg-white text-pedra-900 shadow-[0_8px_24px_rgba(21,32,46,0.16)]">
              <p className="border-b border-pedra-100 px-4 py-2.5 text-xs text-pedra-500">@{access.username}</p>
              <Link href="/conta" className="flex h-11 items-center gap-2 px-4 text-sm font-bold hover:bg-pedra-100">
                <KeyRound className="h-4 w-4 text-manto" /> Minha conta
              </Link>
              <form action="/sair" method="post">
                <button type="submit" className="flex h-11 w-full items-center gap-2 px-4 text-sm font-bold text-erro hover:bg-erro-50">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </form>
            </div>
          </details>
        </div>
        <div className="mx-auto mt-6 max-w-5xl px-4 sm:px-6">
          <p className="text-sm text-manto-100/80 first-letter:uppercase">
            {camp?.name ? `${camp.name} · ` : ''}
            {today}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-[1.75rem]">
            {greeting()}, {access.fullName.split(' ')[0]}
          </h1>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-5xl px-4 pb-12 sm:-mt-12 sm:px-6">
        <ModuleCards items={modules} />
      </main>
    </div>
  );
}
