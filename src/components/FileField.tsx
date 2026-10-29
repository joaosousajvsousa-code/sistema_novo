'use client';

import * as React from 'react';
import { Paperclip } from 'lucide-react';

// Campo de arquivo para comprovantes. Fotos são reduzidas no próprio aparelho
// (até 1600 px, JPEG) para enviar rápido mesmo com internet fraca.
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size < 600_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function FileField({ name = 'file', label = 'Anexar comprovante' }: { name?: string; label?: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setInfo(null);
      return;
    }
    setBusy(true);
    const small = await shrinkImage(f);
    if (small !== f && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(small);
      inputRef.current.files = dt.files;
    }
    setInfo(`${small.name} · ${(small.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
    setBusy(false);
  }

  return (
    <div>
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-pedra-300 bg-white px-4 text-sm font-bold text-manto hover:bg-manto-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cirio">
        <Paperclip className="h-4 w-4" aria-hidden />
        {busy ? 'Preparando…' : label}
        <input ref={inputRef} type="file" name={name} accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="sr-only" onChange={onChange} />
      </label>
      <p className="mt-1 text-xs text-pedra-500">{info ?? 'Foto ou PDF de até 5 MB.'}</p>
    </div>
  );
}
