import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { can, getAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { formatDateTime, todayISO } from '@/lib/format';
import { NO_SIZE, countBy, sizeOrder, type ShirtRow } from '@/lib/shirts';
import { APP_NAME } from '@/config/app';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const access = await getAccess();
  if (!access || !can(access, 'camisetas.ver')) return new NextResponse('Sem permissão.', { status: 403 });
  const camp = await getActiveCamp();
  const supabase = createClient();
  const sp = request.nextUrl.searchParams;
  const version = Number(sp.get('versao')) || null;

  let rows: ShirtRow[];
  let title: string;
  if (version) {
    const { data } = await supabase.from('shirt_orders').select('rows, created_at').eq('version', version).maybeSingle();
    if (!data) return new NextResponse('Versão não encontrada.', { status: 404 });
    rows = (data.rows as { kind: string; person: string; size: string | null; where: string }[]).map((r) => ({ ...r }));
    title = `Pedido versão ${version} · fechado em ${formatDateTime(data.created_at)}`;
  } else {
    const { data, error } = await supabase.rpc('shirt_list');
    if (error) return new NextResponse('Não foi possível gerar.', { status: 500 });
    rows = ((data ?? []) as { kind: string; person: string; shirt_size: string | null; team_or_group: string }[])
      .map((r) => ({ kind: r.kind, person: r.person, size: r.shirt_size, where: r.team_or_group }))
      .filter(
        (r) =>
          (!sp.get('tipo') || r.kind === sp.get('tipo')) &&
          (!sp.get('onde') || `${r.kind}|${r.where}` === sp.get('onde')) &&
          (!sp.get('tamanho') || (r.size || NO_SIZE) === sp.get('tamanho')),
      );
    const filters = [sp.get('tipo'), sp.get('onde')?.split('|')[1], sp.get('tamanho')].filter(Boolean).join(' · ');
    title = `Gerado em ${formatDateTime(new Date().toISOString())}${filters ? ` · filtros: ${filters}` : ''}`;
  }

  const { bySize, byWhere } = countBy(rows);
  const sizes = sizeOrder(camp?.shirt_sizes ?? [], Object.keys(bySize)).filter((s) => bySize[s]);
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  const head = (ws: ExcelJS.Worksheet, row = 1) => {
    const r = ws.getRow(row);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D4A2A' } };
  };

  const t = wb.addWorksheet('Totais');
  t.addRow([`${APP_NAME} · Camisetas`]).font = { bold: true, size: 14 };
  t.addRow([title]);
  t.addRow([]);
  t.addRow(['Tamanho', 'Quantidade']);
  head(t, 4);
  sizes.forEach((s) => t.addRow([s, bySize[s]]));
  t.addRow(['Total', rows.length]).font = { bold: true };
  t.columns = [{ width: 22 }, { width: 14 }];

  const m = wb.addWorksheet('Por equipe e tropa');
  m.addRow(['Tipo', 'Equipe / tropa', ...sizes, 'Total']);
  head(m);
  Object.entries(byWhere)
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .forEach(([k, v]) => m.addRow([v.kind === 'Recruta' ? 'Tropa' : 'Equipe', k.split('|')[1], ...sizes.map((s) => v.sizes[s] ?? 0), v.total]));
  m.columns = [{ width: 10 }, { width: 26 }, ...sizes.map(() => ({ width: 8 })), { width: 9 }];

  const l = wb.addWorksheet('Lista nominal');
  l.addRow(['Nome', 'Tipo', 'Equipe / tropa', 'Tamanho']);
  head(l);
  rows.forEach((r) => l.addRow([r.person, r.kind, r.where, r.size ?? NO_SIZE]));
  l.columns = [{ width: 34 }, { width: 14 }, { width: 24 }, { width: 12 }];
  l.autoFilter = { from: 'A1', to: 'D1' };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="camisetas-${version ? `versao-${version}` : todayISO()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
