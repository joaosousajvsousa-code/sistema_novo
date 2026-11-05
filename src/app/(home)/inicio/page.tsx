import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { requireAccess } from '@/lib/auth';
import { getActiveCamp } from '@/lib/camp';
import { buildModules } from '@/components/layout/nav';
import { ModuleCards } from '@/components/layout/NavLinks';
import { InstallApp } from '@/components/pwa/InstallApp';
import { LogoMark } from '@/components/Logo';
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
      <header className="relative isolate overflow-hidden bg-manto-800 pb-20 pt-5 text-white sm:pb-24">
        {/* mesma textura da tela de login: mapa topográfico, luz e pinheiros */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_45%,rgba(200,161,101,0.22),transparent_50%),radial-gradient(ellipse_at_50%_50%,transparent_45%,rgba(10,14,6,0.5))]"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[clamp(90px,12vw,190px)] bg-[url('/silhueta-acampamento.svg')] bg-cover bg-bottom opacity-90" />

        <div className="mx-auto flex max-w-5xl justify-end px-4 sm:px-6">
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
        <div className="mx-auto flex max-w-5xl items-center gap-5 px-4 sm:gap-8 sm:px-6">
          <LogoMark height={176} priority className="h-28 w-auto drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] sm:h-44" />
          <div className="min-w-0">
            <p className="text-sm text-cirio-50/80 first-letter:uppercase">
              {camp?.name ? `${camp.name} · ` : ''}
              {today}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-4xl">
              {greeting()}, {access.fullName.split(' ')[0]}
            </h1>
            <div aria-hidden className="mt-3 h-1 w-24 rounded-full bg-[repeating-linear-gradient(135deg,#C8A165_0_8px,transparent_8px_14px)]" />
          </div>
        </div>
      </header>
      <main className="relative mx-auto -mt-12 max-w-5xl px-4 pb-12 sm:-mt-14 sm:px-6">
        <ModuleCards items={modules} />
        <InstallApp />
      </main>
    </div>
  );
}
