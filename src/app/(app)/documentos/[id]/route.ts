import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Abre um comprovante: confere a permissão pelas regras do banco e redireciona
// para um link temporário (1 minuto). Nenhum arquivo tem endereço permanente.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAccess();
  if (!access) return NextResponse.redirect(new URL('/login', request.url));
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return new NextResponse('Arquivo não encontrado.', { status: 404 });

  const { data: doc } = await createClient().from('private_documents').select('id, path, bucket, file_name, camp_id').eq('id', params.id).maybeSingle();
  if (!doc) return new NextResponse('Arquivo não encontrado ou sem permissão.', { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(doc.bucket).createSignedUrl(doc.path, 60, {
    download: request.nextUrl.searchParams.get('baixar') === '1' ? doc.file_name : undefined,
  });
  if (error || !data?.signedUrl) return new NextResponse('Não foi possível abrir o arquivo.', { status: 502 });
  await admin.from('audit_logs').insert({
    camp_id: doc.camp_id,
    user_id: access.userId,
    action: 'VIEW_DOCUMENT',
    entity: 'private_documents',
    entity_id: doc.id,
  });
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
}
