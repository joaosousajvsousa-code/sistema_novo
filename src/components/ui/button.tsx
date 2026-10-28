import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet-danger';
type Size = 'md' | 'lg' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'bg-manto text-white hover:bg-manto-600 active:bg-manto-700 disabled:bg-pedra-300',
  secondary: 'bg-white text-pedra-900 border border-pedra-300 hover:bg-pedra-100 active:bg-pedra-200 disabled:text-pedra-400',
  ghost: 'text-manto hover:bg-manto-50 active:bg-manto-100 disabled:text-pedra-400',
  danger: 'bg-erro text-white hover:bg-[#9A1F18] disabled:bg-pedra-300',
  'quiet-danger': 'text-erro hover:bg-erro-50 disabled:text-pedra-400',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors disabled:cursor-not-allowed select-none whitespace-nowrap',
    variants[variant],
    sizes[size],
    className,
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
