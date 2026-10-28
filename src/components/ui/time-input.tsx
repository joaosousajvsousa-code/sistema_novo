'use client';

import * as React from 'react';
import { Input } from './input';

function mask(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

// Horário sempre em 24h (HH:MM), com teclado numérico no celular.
export const TimeInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value' | 'type'> & { defaultValue?: string | null }
>(function TimeInput({ defaultValue, ...props }, ref) {
  const [text, setText] = React.useState(defaultValue ?? '');
  return (
    <Input
      ref={ref}
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      value={text}
      onChange={(e) => setText(mask(e.target.value))}
    />
  );
});
