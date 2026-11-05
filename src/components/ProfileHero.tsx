import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// Cabeçalho das telas de detalhe: faixa com textura, avatar e o nome em destaque.
export function ProfileHero({
  back,
  kicker,
  title,
  avatar,
  initials,
  chips,
  description,
  actions,
  aside,
}: {
  back?: { href: string; label: string };
  kicker?: string;
  title: React.ReactNode;
  avatar?: React.ReactNode;
  initials?: string;
  chips?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <>
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-manto shadow-[0_1px_2px_rgba(21,32,46,0.06)] ring-1 ring-pedra-200 hover:bg-manto-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {back.label}
        </Link>
      ) : null}
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-20px_rgba(21,32,46,0.45)]">
        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-manto-800 bg-[url('/textura-topografica.svg')] bg-cover bg-center sm:h-24" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(ellipse_at_85%_0%,rgba(200,161,101,0.3),transparent_60%)] sm:h-24" />
        <div className="relative flex flex-col gap-4 px-5 pb-5 pt-8 sm:flex-row sm:items-start sm:gap-6 sm:px-6 sm:pt-10">
          <div className="flex justify-center sm:block">
            {avatar ?? (
              <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-manto text-3xl font-bold text-cirio shadow-[0_10px_30px_-12px_rgba(21,32,46,0.6)] ring-4 ring-white sm:h-28 sm:w-28">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:pt-16 sm:text-left">
            {kicker ? <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cirio-700">{kicker}</p> : null}
            <h1 className="text-2xl leading-tight sm:text-3xl">{title}</h1>
            {description ? <div className="mt-1 text-sm text-pedra-600">{description}</div> : null}
            {chips ? <div className="mt-2.5 flex flex-wrap justify-center gap-2 sm:justify-start">{chips}</div> : null}
            {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">{actions}</div> : null}
          </div>
          {aside ? <div className="sm:w-60 sm:shrink-0 sm:pt-16">{aside}</div> : null}
        </div>
      </section>
    </>
  );
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
