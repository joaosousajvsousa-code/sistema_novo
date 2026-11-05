import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-7">
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 mb-3 inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-manto shadow-[0_1px_2px_rgba(21,32,46,0.06)] ring-1 ring-pedra-200 hover:bg-manto-50"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight tracking-tight sm:text-[2rem]">{title}</h1>
          <div aria-hidden className="mt-2 h-1 w-14 rounded-full bg-[repeating-linear-gradient(135deg,#C8A165_0_6px,transparent_6px_10px)]" />
          {description ? <div className="mt-2.5 max-w-prose text-sm text-pedra-600">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-22px_rgba(21,32,46,0.45)]', className)}>
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-pedra-100 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 gap-3">
            <span aria-hidden className="mt-1 h-4 w-1 shrink-0 rounded-full bg-cirio" />
            <div className="min-w-0">
              <h2 className="text-base leading-snug">{title}</h2>
              {description ? <p className="mt-0.5 text-xs text-pedra-500">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-pedra-200 pt-5 first-of-type:border-0 first-of-type:pt-0 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <legend className="flex items-center gap-2 text-base font-bold">
          <span aria-hidden className="h-4 w-1 rounded-full bg-cirio" />
          {title}
        </legend>
        {description ? <p className="mt-1 text-xs text-pedra-500">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type Tone = 'neutral' | 'manto' | 'ok' | 'aviso' | 'erro' | 'cirio';
const tones: Record<Tone, string> = {
  neutral: 'bg-pedra-100 text-pedra-700',
  manto: 'bg-manto-50 text-manto',
  ok: 'bg-ok-50 text-ok',
  aviso: 'bg-aviso-50 text-aviso',
  erro: 'bg-erro-50 text-erro',
  cirio: 'bg-cirio-50 text-cirio-700',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold', tones[tone], className)}>{children}</span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {icon ? <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-manto-50 text-manto ring-8 ring-manto-50/40">{icon}</div> : null}
      <p className="text-base font-bold text-pedra-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-pedra-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = 'manto',
  title,
  children,
  className,
}: {
  tone?: 'manto' | 'aviso' | 'erro' | 'ok';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const map = {
    manto: 'border-manto/15 border-l-manto bg-manto-50 text-manto-700',
    aviso: 'border-aviso/20 border-l-aviso bg-aviso-50 text-[#6E480D]',
    erro: 'border-erro/20 border-l-erro bg-erro-50 text-erro',
    ok: 'border-ok/20 border-l-ok bg-ok-50 text-ok',
  };
  return (
    <div className={cn('rounded-xl border border-l-4 px-4 py-3 text-sm', map[tone], className)}>
      {title ? <p className="font-bold">{title}</p> : null}
      <div className={title ? 'mt-0.5' : undefined}>{children}</div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  makeHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = 'inline-flex h-10 items-center rounded-lg border border-pedra-200 bg-white px-4 text-sm font-bold text-manto shadow-sm hover:bg-manto-50';
  return (
    <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-3 text-sm text-pedra-600">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={linkCls} href={makeHref(page - 1)}>
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={linkCls} href={makeHref(page + 1)}>
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Tabs({ items, current }: { items: { key: string; label: string; href: string }[]; current: string }) {
  return (
    <nav aria-label="Seções" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex min-w-max gap-1 rounded-xl border border-pedra-200 bg-white p-1 shadow-[0_1px_2px_rgba(21,32,46,0.05)]">
        {items.map((it) => {
          const active = it.key === current;
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                scroll={false}
                className={cn(
                  'inline-flex h-10 items-center rounded-lg px-4 text-sm font-bold transition-colors',
                  active ? 'bg-manto text-white shadow-[0_6px_14px_-8px_rgba(61,74,42,0.9)]' : 'text-pedra-500 hover:bg-pedra-100 hover:text-pedra-900',
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DataList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-pedra-400">{it.label}</dt>
          <dd className="mt-0.5 text-sm font-bold text-pedra-900">{it.value || <span className="font-normal text-pedra-400">Não informado</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

// Linha de indicadores no topo das telas (números grandes em cartões).
export function StatRow({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'ok' | 'aviso' | 'erro' | 'manto' }[];
  className?: string;
}) {
  const toneCls = { ok: 'text-ok', aviso: 'text-aviso', erro: 'text-erro', manto: 'text-manto' };
  return (
    <dl className={cn('mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-pedra-200 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(21,32,46,0.45)]">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-pedra-400">{it.label}</dt>
          <dd className={cn('mt-1.5 text-2xl font-bold leading-none sm:text-3xl', it.tone ? toneCls[it.tone] : 'text-pedra-900')}>
            {it.value}
            {it.sub ? <span className="ml-1 text-sm font-normal text-pedra-400">{it.sub}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
