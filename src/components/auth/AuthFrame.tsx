import { Logo } from '@/components/Logo';

// Moldura das telas sem login: faixa azul com a marca e o cartão do formulário.
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-pedra lg:flex-row">
      <div className="relative overflow-hidden bg-manto px-6 pb-16 pt-8 text-white lg:flex lg:w-[44%] lg:flex-col lg:p-12">
        <Logo light className="relative z-10" />
        <div className="relative z-10 mt-[14vh] hidden max-w-sm lg:block">
          <p className="text-2xl font-bold leading-snug">Equipes, recrutas e programação do acampamento num só lugar.</p>
          <p className="mt-3 text-sm text-manto-100/70">Acesso restrito à coordenação e às equipes de serviço.</p>
        </div>
        <svg aria-hidden viewBox="0 0 400 120" className="absolute -bottom-px left-0 h-16 w-full text-pedra lg:hidden" preserveAspectRatio="none">
          <path d="M0 120 L120 40 L200 95 L280 20 L400 120 Z" fill="currentColor" />
        </svg>
        <svg aria-hidden viewBox="0 0 400 200" className="pointer-events-none absolute bottom-0 left-0 hidden max-h-[38%] w-full text-manto-600 lg:block" preserveAspectRatio="xMidYMax meet">
          <path d="M0 200 L110 70 L190 150 L290 30 L400 200 Z" fill="currentColor" />
          <path d="M290 10v18M282 17h16" stroke="#C29B4A" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <main className="-mt-8 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center">
        <div className="w-full max-w-md rounded-lg border border-pedra-200 bg-white p-6 sm:p-8">
          <h1 className="text-xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-pedra-600">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
