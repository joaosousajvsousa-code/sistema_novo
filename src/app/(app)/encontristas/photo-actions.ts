'use server';

import { revalidatePath } from 'next/cache';
import { getAccess, can } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { deletePhoto, storePhoto } from '@/lib/photos';
import { photoUrl } from '@/lib/photo-url';
import { uuid } from '@/lib/validation';

export type PhotoResult = { ok: true; url: string | null } | { ok: false; error: string };

async function check(id: unknown): Promise<{ id: string; campId: string } | { error: string }> {
  const access = await getAccess();
  if (!access || !can(access, 'encontristas.editar')) return { error: 'Você não tem permissão para alterar fotos.' };
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { error: 'Registro inválido.' };
  const camp = await getActiveCamp();
  // A leitura pelo cliente normal confere as regras do banco.
  const { data } = await createClient().from('encontristas').select('id, camp_id').eq('id', parsed.data).maybeSingle();
  if (!data) return { error: 'Recruta não encontrado.' };
  if (!camp || camp.id !== data.camp_id || !campEditable(camp)) return { error: 'O acampamento está encerrado. Os registros ficam só para consulta.' };
  return { id: data.id, campId: data.camp_id };
}

function refresh(id: string) {
  revalidatePath(`/encontristas/${id}`);
  revalidatePath('/encontristas');
  revalidatePath('/encontristas/fotos');
}

export async function uploadPhoto(fd: FormData): Promise<PhotoResult> {
  const c = await check(fd.get('id'));
  if ('error' in c) return { ok: false, error: c.error };
  const file = fd.get('photo');
  if (!(file instanceof File)) return { ok: false, error: 'Escolha uma foto.' };
  const res = await storePhoto({ file, campId: c.campId, encontristaId: c.id });
  if (res.error) return { ok: false, error: res.error };
  const { data } = await createClient().from('encontristas').select('photo_path').eq('id', c.id).maybeSingle();
  refresh(c.id);
  return { ok: true, url: photoUrl(c.id, data?.photo_path) };
}

export async function removePhoto(id: string): Promise<PhotoResult> {
  const c = await check(id);
  if ('error' in c) return { ok: false, error: c.error };
  const res = await deletePhoto(c.id);
  if (res.error) return { ok: false, error: res.error };
  refresh(c.id);
  return { ok: true, url: null };
}
