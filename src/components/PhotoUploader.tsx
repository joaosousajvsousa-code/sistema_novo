'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { resizeImage } from '@/lib/resize-image';
import { removePhoto, uploadPhoto } from '@/app/(app)/encontristas/photo-actions';

// Foto grande do recruta com os botões de trocar e remover.
export function PhotoUploader({
  id,
  name,
  url,
  canEdit,
  variant = 'profile',
}: {
  id: string;
  name: string;
  url: string | null;
  canEdit: boolean;
  variant?: 'profile' | 'tile';
}) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [src, setSrc] = React.useState(url);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setSrc(url), [url]);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.set('id', id);
      fd.set('photo', new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
      const res = await uploadPhoto(fd);
      if (!res.ok) toast.error(res.error);
      else {
        setSrc(res.url);
        toast.success(`Foto de ${name.split(' ')[0]} salva`);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function onRemove() {
    if (!window.confirm('Remover a foto deste recruta?')) return;
    setBusy(true);
    const res = await removePhoto(id);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      setSrc(null);
      toast.success('Foto removida');
      router.refresh();
    }
  }

  const tile = variant === 'tile';
  return (
    <div className={cn('flex', tile ? 'flex-col items-center' : 'flex-col items-center gap-3 sm:items-start')}>
      <button
        type="button"
        disabled={!canEdit || busy}
        onClick={() => input.current?.click()}
        aria-label={canEdit ? (src ? `Trocar a foto de ${name}` : `Adicionar foto de ${name}`) : `Foto de ${name}`}
        className={cn(
          'group relative flex items-center justify-center overflow-hidden bg-manto-50 font-bold text-manto ring-1 ring-pedra-200 disabled:cursor-default',
          tile ? 'aspect-square w-full rounded-xl text-3xl' : 'h-36 w-36 rounded-2xl text-4xl shadow-[0_10px_30px_-16px_rgba(21,32,46,0.5)] sm:h-44 sm:w-44',
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Foto de ${name}`} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1">
            <span aria-hidden>{initials}</span>
            {canEdit ? <span className="text-[11px] font-bold uppercase tracking-wider text-manto/70">Adicionar foto</span> : null}
          </span>
        )}
        {canEdit ? (
          <span className={cn('absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-manto-800/80 py-1.5 text-xs font-bold text-white', src ? 'opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100' : 'hidden')}>
            <Camera className="h-3.5 w-3.5" aria-hidden /> Trocar
          </span>
        ) : null}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-7 w-7 animate-spin text-manto" aria-label="Enviando" />
          </span>
        ) : null}
      </button>
      {canEdit ? (
        <>
          <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onFile(e.target.files?.[0])} aria-hidden />
          {!tile ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold text-manto hover:bg-manto-50"
              >
                <Camera className="h-4 w-4" /> {src ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {src ? (
                <button type="button" onClick={onRemove} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold text-erro hover:bg-erro-50">
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
