'use client';

import * as React from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { resizeImage } from '@/lib/resize-image';

// Campo de foto para formulários: reduz a foto no celular e coloca no envio.
export function PhotoField({ name = 'photo' }: { name?: string }) {
  const picker = React.useRef<HTMLInputElement>(null);
  const carrier = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await resizeImage(file);
      const resized = new File([blob], 'foto.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(resized);
      if (carrier.current) carrier.current.files = dt.files;
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler esta foto.');
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  }

  function clear() {
    if (carrier.current) carrier.current.value = '';
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-sm font-bold text-pedra-700">Foto</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-pedra-300 bg-pedra text-pedra-400 hover:border-manto hover:text-manto"
          aria-label={preview ? 'Trocar a foto' : 'Adicionar foto'}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Prévia da foto" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-7 w-7" aria-hidden />
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-manto" />
            </span>
          ) : null}
        </button>
        <div className="text-sm">
          <button type="button" onClick={() => picker.current?.click()} className="font-bold text-manto hover:underline">
            {preview ? 'Trocar foto' : 'Tirar ou escolher foto'}
          </button>
          {preview ? (
            <button type="button" onClick={clear} className="ml-3 inline-flex items-center gap-1 font-bold text-erro hover:underline">
              <X className="h-3.5 w-3.5" /> Tirar
            </button>
          ) : null}
          <p className="mt-0.5 text-xs text-pedra-500">Opcional. Ajuda a reconhecer o recruta na distribuição e na presença.</p>
          {error ? <p className="mt-1 text-xs font-bold text-erro">{error}</p> : null}
        </div>
      </div>
      <input ref={picker} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onPick(e.target.files?.[0])} />
      <input ref={carrier} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden />
    </div>
  );
}
