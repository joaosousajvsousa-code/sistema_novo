import Image from 'next/image';
import logo from '@/assets/logo-holy-camp.png';
import { APP_NAME } from '@/config/app';
import { cn } from '@/lib/cn';

// Selo do HOLY CAMP (mochila). O tamanho é dado pela altura.
export function LogoMark({ className, height = 40, priority }: { className?: string; height?: number; priority?: boolean }) {
  const width = Math.round((logo.width / logo.height) * height);
  return <Image src={logo} alt={APP_NAME} width={width} height={height} priority={priority} className={cn('shrink-0 select-none', className)} />;
}

export function Logo({ className, light, height = 40 }: { className?: string; light?: boolean; height?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark height={height} priority />
      <span className={cn('text-lg font-bold tracking-tight', light ? 'text-white' : 'text-manto')}>{APP_NAME}</span>
    </span>
  );
}
