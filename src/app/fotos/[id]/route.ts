import { NextResponse, type NextRequest } from 'next/server';
import { canAny, getAccess } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Foto do recruta: só para quem pode ver os recrutas em alguma tela.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAccess();
  if (!access || !canAny(access, ['encontristas.ver', 'presenca.marcar', 'grupos.gerenciar', 'saude.medicar'])) {
    return new NextResponse('Sem permissão.', { status: 403 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse('Não encontrado.', { status: 404 });
  const admin = createAdminClient();
  const { data } = await admin.from('encontristas').select('photo_path').eq('id', params.id).maybeSingle();
  if (!data?.photo_path) return new NextResponse('Não encontrado.', { status: 404 });
  const { data: blob, error } = await admin.storage.from('fotos').download(data.photo_path);
  if (error || !blob) return new NextResponse('Não encontrado.', { status: 404 });
  return new NextResponse(Buffer.from(await blob.arrayBuffer()), {
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
      // Privado: só no navegador de quem abriu; o endereço muda quando a foto muda.
      'Cache-Control': 'private, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
