import { LogoMark } from '@/components/Logo';

// Moldura das telas sem login: mapa topográfico ao fundo, pinheiros na base,
// logo ao centro e o formulário num cartão.
export function AuthFrame({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-manto-800 px-4 pb-40 pt-10 sm:pb-48">
      {/* textura de mapa de campanha */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center" />
      {/* luz suave atrás da logo e escurecimento nas bordas */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,rgba(200,161,101,0.20),transparent_55%),radial-gradient(ellipse_at_50%_50%,transparent_40%,rgba(10,14,6,0.55))]"
      />
      {/* montanhas e pinheiros */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[clamp(150px,18.75vw,300px)] bg-[url('/silhueta-acampamento.svg')] bg-cover bg-bottom" />

      <LogoMark height={176} priority className="mb-7" />

      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(200,161,101,0.35)]">
        <div aria-hidden className="h-1.5 bg-[repeating-linear-gradient(135deg,#C8A165_0_10px,#3D4A2A_10px_20px)]" />
        <div className="p-6 sm:p-7">
          {title ? <h1 className="text-xl">{title}</h1> : null}
          {subtitle ? <p className="mt-1 text-sm text-pedra-600">{subtitle}</p> : null}
          <div className={title || subtitle ? 'mt-6' : undefined}>{children}</div>
        </div>
      </div>
    </main>
  );
}
