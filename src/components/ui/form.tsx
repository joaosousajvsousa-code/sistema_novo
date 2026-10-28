'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActionState } from '@/lib/action';
import { Button, type ButtonProps } from './button';

const FieldErrorsContext = React.createContext<Record<string, string>>({});

type ActionFn = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  showSuccessToast = true,
  id,
}: {
  action: ActionFn;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  showSuccessToast?: boolean;
  id?: string;
}) {
  const [state, formAction] = useFormState(action, {} as ActionState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!state.ts) return;
    if (state.ok) {
      if (showSuccessToast && state.message) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    } else if (state.error) {
      errorRef.current?.focus();
      const firstInvalid = state.fieldErrors && Object.keys(state.fieldErrors)[0];
      if (firstInvalid) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(firstInvalid)}"]`);
        el?.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  return (
    <FieldErrorsContext.Provider value={state.ok ? {} : state.fieldErrors ?? {}}>
      <form ref={formRef} action={formAction} className={className} id={id} noValidate>
        {state.error && !state.ok ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mb-4 rounded-md border border-erro/30 bg-erro-50 px-4 py-3 text-sm text-erro outline-none"
          >
            {state.error}
          </div>
        ) : null}
        {children}
      </form>
    </FieldErrorsContext.Provider>
  );
}

export function useFieldError(name: string) {
  return React.useContext(FieldErrorsContext)[name];
}

export function Field({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactElement;
  className?: string;
}) {
  const error = useFieldError(name);
  const id = `f-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = React.cloneElement(children, {
    id,
    name,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-required': required || undefined,
  });
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-bold text-pedra-700">
        {label}
        {required ? <span className="ml-0.5 text-erro" aria-hidden> *</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-pedra-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-bold text-erro">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText = 'Salvando…',
  confirmMessage,
  ...props
}: ButtonProps & { pendingText?: string; confirmMessage?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
        props.onClick?.(e);
      }}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-16 z-10 -mx-4 mt-6 flex flex-col-reverse gap-2 border-t border-pedra-200 bg-pedra/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
