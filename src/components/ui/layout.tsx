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
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="-ml-1 mb-2 inline-flex items-center gap-1 rounded text-sm font-bold text-manto hover:underline">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 max-w-prose text-sm text-pedra-600">{description}</p> : null}
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
    <section className={cn('rounded-lg border border-pedra-200 bg-white', className)}>
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-pedra-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-pedra-500">{description}</p> : null}
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
        <legend className="text-base font-bold">{title}</legend>
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
    <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold', tones[tone], className)}>{children}</span>
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
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {icon ? <div className="mb-3 text-pedra-400">{icon}</div> : null}
      <p className="font-bold text-pedra-700">{title}</p>
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
    manto: 'border-manto/20 bg-manto-50 text-manto-700',
    aviso: 'border-aviso/25 bg-aviso-50 text-[#6E480D]',
    erro: 'border-erro/25 bg-erro-50 text-erro',
    ok: 'border-ok/25 bg-ok-50 text-ok',
  };
  return (
    <div className={cn('rounded-md border px-4 py-3 text-sm', map[tone], className)}>
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
  const linkCls = 'inline-flex h-10 items-center rounded-md border border-pedra-300 bg-white px-4 text-sm font-bold text-manto';
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
    <nav aria-label="Seções" className="-mx-4 mb-5 overflow-x-auto border-b border-pedra-200 px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((it) => {
          const active = it.key === current;
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                scroll={false}
                className={cn(
                  'inline-flex h-11 items-center border-b-2 px-3 text-sm font-bold',
                  active ? 'border-cirio text-pedra-900' : 'border-transparent text-pedra-500 hover:text-pedra-900',
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
          <dt className="text-xs text-pedra-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm font-bold text-pedra-900">{it.value || <span className="font-normal text-pedra-400">Não informado</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
