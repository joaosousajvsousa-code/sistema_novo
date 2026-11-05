import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Guarda a foto do recruta no bucket privado e troca na ficha.
// Chame só DEPOIS de conferir a permissão (a chave de serviço ignora as regras).
export async function storePhoto(opts: { file: File; campId: string; encontristaId: string }): Promise<{ error?: string }> {
  const { file } = opts;
  const ext = TYPES[file.type];
  if (!ext) return { error: 'Envie uma foto (JPG, PNG ou WEBP).' };
  if (file.size <= 0) return { error: 'A foto está vazia.' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'A foto passa de 2 MB. Tente de novo.' };
  const admin = createAdminClient();
  const path = `${opts.campId}/${opts.encontristaId}/${crypto.randomUUID()}.${ext}`;
  const { error: upError } = await admin.storage.from('fotos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upError) return { error: 'Não foi possível guardar a foto. Tente de novo.' };
  const { data: old } = await admin.from('encontristas').select('photo_path').eq('id', opts.encontristaId).maybeSingle();
  const { error } = await admin.from('encontristas').update({ photo_path: path }).eq('id', opts.encontristaId);
  if (error) {
    await admin.storage.from('fotos').remove([path]);
    return { error: 'Não foi possível salvar a foto na ficha.' };
  }
  if (old?.photo_path) await admin.storage.from('fotos').remove([old.photo_path]);
  return {};
}

export async function deletePhoto(encontristaId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: old } = await admin.from('encontristas').select('photo_path').eq('id', encontristaId).maybeSingle();
  const { error } = await admin.from('encontristas').update({ photo_path: null }).eq('id', encontristaId);
  if (error) return { error: 'Não foi possível remover a foto.' };
  if (old?.photo_path) await admin.storage.from('fotos').remove([old.photo_path]);
  return {};
}
