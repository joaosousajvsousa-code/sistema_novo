import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export type DocumentRow = { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string };

// Envia o arquivo para o bucket privado. Chame só DEPOIS de conferir a
// permissão de quem pediu (a chave de serviço ignora as regras do banco).
export async function storeDocument(opts: {
  file: File;
  campId: string;
  entity: 'pagamento' | 'despesa' | 'receita';
  entityId: string;
  userId: string;
}): Promise<{ error?: string }> {
  const { file } = opts;
  const ext = TYPES[file.type];
  if (!ext) return { error: 'Envie uma foto (JPG, PNG ou WEBP) ou um PDF.' };
  if (file.size <= 0) return { error: 'O arquivo está vazio.' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'O arquivo passa de 5 MB. Envie uma foto menor ou um PDF mais leve.' };

  const admin = createAdminClient();
  const path = `${opts.campId}/${opts.entity}/${opts.entityId}/${crypto.randomUUID()}.${ext}`;
  const { error: upError } = await admin.storage
    .from('comprovantes')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upError) return { error: 'Não foi possível guardar o arquivo. Tente de novo.' };

  const name = (file.name || `comprovante.${ext}`).replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120) || `comprovante.${ext}`;
  const { error: dbError } = await admin.from('private_documents').insert({
    camp_id: opts.campId,
    bucket: 'comprovantes',
    path,
    file_name: name,
    mime_type: file.type,
    size_bytes: file.size,
    entity: opts.entity,
    entity_id: opts.entityId,
    uploaded_by: opts.userId,
  });
  if (dbError) {
    await admin.storage.from('comprovantes').remove([path]);
    return { error: 'Não foi possível registrar o arquivo. Tente de novo.' };
  }
  return {};
}

// Lista os comprovantes visíveis para quem está logado (regras do banco).
export async function listDocuments(entity: string, entityId: string): Promise<DocumentRow[]> {
  const { data } = await createClient()
    .from('private_documents')
    .select('id, file_name, mime_type, size_bytes, created_at')
    .eq('entity', entity)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  return (data ?? []) as DocumentRow[];
}
