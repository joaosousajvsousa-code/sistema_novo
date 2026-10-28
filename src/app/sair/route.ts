import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function signOut(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const motivo = request.nextUrl.searchParams.get('motivo');
  const url = new URL('/login', request.url);
  if (motivo) url.searchParams.set('motivo', motivo);
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;
