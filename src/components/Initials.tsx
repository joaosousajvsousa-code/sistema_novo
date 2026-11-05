import { cn } from '@/lib/cn';

// Círculo com as iniciais (para quem não tem foto).
export function Initials({ name, className }: { name: string; className?: string }) {
  const ini = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span aria-hidden className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-manto text-sm font-bold text-cirio ring-2 ring-white', className)}>
      {ini}
    </span>
  );
}
