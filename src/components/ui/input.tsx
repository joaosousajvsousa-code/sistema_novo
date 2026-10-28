import * as React from 'react';
import { cn } from '@/lib/cn';

const base =
  'block w-full rounded-md border border-pedra-300 bg-white px-3 text-base text-pedra-900 placeholder:text-pedra-400 ' +
  'focus:border-manto focus:outline-none focus:ring-2 focus:ring-manto/20 disabled:bg-pedra-100 disabled:text-pedra-500 ' +
  'aria-[invalid=true]:border-erro aria-[invalid=true]:ring-erro/15';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(base, 'h-11', className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(base, 'py-2.5 leading-normal', className)} {...props} />;
  },
);

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236B7789' stroke-width='2'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, style, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(base, 'h-11 appearance-none pr-10', className)}
      style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', ...style }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn('h-5 w-5 shrink-0 rounded border-pedra-300 text-manto accent-[#1B2F4E] focus-visible:ring-2', className)}
      {...props}
    />
  );
}
