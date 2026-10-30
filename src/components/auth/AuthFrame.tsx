import { LogoMark } from '@/components/Logo';

// Moldura das telas sem login: fundo verde, logo no centro e o formulário.
export function AuthFrame({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-manto px-4 py-10">
      <LogoMark height={168} priority className="mb-8" />
      <div className="w-full max-w-sm rounded-lg bg-white p-6 sm:p-7">
        {title ? <h1 className="text-xl">{title}</h1> : null}
        {subtitle ? <p className="mt-1 text-sm text-pedra-600">{subtitle}</p> : null}
        <div className={title || subtitle ? 'mt-6' : undefined}>{children}</div>
      </div>
    </main>
  );
}
