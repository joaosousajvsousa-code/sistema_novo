import { APP_NAME } from '@/config/app';
import { cn } from '@/lib/cn';

// Marca: uma tenda cuja cumeeira forma uma cruz discreta.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('h-8 w-8', className)}>
      <rect width="32" height="32" rx="8" fill="#1B2F4E" />
      <path d="M16 6.5v5.5M13.5 8.6h5" stroke="#C29B4A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 12L7 25h18L16 12z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 12v13M13 25l3-5 3 5" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-lg font-bold tracking-tight', light ? 'text-white' : 'text-manto')}>{APP_NAME}</span>
    </span>
  );
}
