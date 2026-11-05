import { cn } from '@/lib/cn';
import { photoUrl } from '@/lib/photo-url';

const SIZES = { sm: 'h-10 w-10 text-sm', md: 'h-12 w-12 text-base', lg: 'h-20 w-20 text-2xl', xl: 'h-32 w-32 text-4xl sm:h-40 sm:w-40' };

// Foto do recruta (ou as iniciais, quando não há foto).
export function RecrutaAvatar({ id, name, path, size = 'sm', className }: { id: string; name: string; path?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const src = photoUrl(id, path);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-manto-50 font-bold text-manto ring-1 ring-pedra-200', SIZES[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Foto de ${name}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
