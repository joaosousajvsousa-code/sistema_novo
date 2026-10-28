'use client';

import * as React from 'react';
import { Input } from './input';

function isoToBr(iso?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function brToIso(br: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return br.replace(/\D/g, '') ? 'invalida' : '';
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return 'invalida';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function mask(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Data sempre no formato DD/MM/AAAA, com teclado numérico no celular.
// Envia o valor no formato AAAA-MM-DD no campo oculto com o nome do Field.
export const DateInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value' | 'type'> & { defaultValue?: string | null }
>(function DateInput({ name, defaultValue, ...props }, ref) {
  const [text, setText] = React.useState(isoToBr(defaultValue));
  return (
    <>
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete={props.autoComplete ?? 'off'}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        value={text}
        onChange={(e) => setText(mask(e.target.value))}
      />
      <input type="hidden" name={name} value={brToIso(text)} />
    </>
  );
});
