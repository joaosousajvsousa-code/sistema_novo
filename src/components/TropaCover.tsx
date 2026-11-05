import Image from 'next/image';
import { cn } from '@/lib/cn';
import { tropaImage } from '@/lib/tropas';

// Capa da tropa: a imagem do tema ou, sem imagem, um cartão verde com o nome.
export function TropaCover({ g, className, priority }: { g: { name: string; image?: string | null }; className?: string; priority?: boolean }) {
  const src = tropaImage(g);
  if (src) {
    return (
      <div className={cn('relative aspect-[960/590] w-full', className)}>
        <Image src={src} alt={g.name} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-contain" priority={priority} />
      </div>
    );
  }
  return (
    <div className={cn('relative isolate flex aspect-[960/590] w-full items-center justify-center overflow-hidden rounded-xl bg-manto-800 p-6', className)}>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center" />
      <div aria-hidden className="absolute inset-3 -z-10 rounded-lg border-2 border-cirio/60" />
      <p className="text-center text-2xl font-bold uppercase tracking-wide text-cirio-50 sm:text-3xl">{g.name}</p>
    </div>
  );
}
