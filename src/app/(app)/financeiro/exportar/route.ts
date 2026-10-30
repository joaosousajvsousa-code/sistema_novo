import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { can, getAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/labels';
import { formatDateTime, todayISO } from '@/lib/format';
import { APP_NAME } from '@/config/app';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MONEY = '"R$" #,##0.00;[Red]-"R$" #,##0.00';

function toDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export async function GET() {
  const access = await getAccess();
  if (!access || !can(access, 'financeiro.gerenciar')) return new NextResponse('Sem permissão.', { status: 403 });
  const camp = await getActiveCamp();
  if (!camp) return new NextResponse('Acampamento não encontrado.', { status: 404 });
  const supabase = createClient();

  const [{ data: summary }, { data: entries }, { data: payments }] = await Promise.all([
    supabase.rpc('finance_summary'),
    supabase
      .from('finance_entries')
      .select('kind, description, amount, entry_date, responsible, notes, cancelled_at, cancel_reason, category:finance_categories(name), team:service_teams(name)')
      .eq('camp_id', camp.id)
      .order('entry_date'),
    supabase
      .from('service_team_memberships')
      .select('payment_status, payment_expected, payment_paid, payment_date, payment_method, team:service_teams(name), person:people(full_name)')
      .eq('camp_id', camp.id)
      .eq('status', 'ativa'),
  ]);
  const s = (summary ?? {}) as Record<string, unknown>;

  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();

  const header = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D4A2A' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  // Resumo
  const r = wb.addWorksheet('Resumo');
  r.columns = [
    { header: 'Item', key: 'k', width: 42 },
    { header: 'Valor', key: 'v', width: 18, style: { numFmt: MONEY } },
  ];
  r.addRows([
    { k: 'Pagamentos confirmados dos soldados/servos', v: Number(s.fees ?? 0) },
    { k: 'Outras receitas', v: Number(s.other_income ?? 0) },
    { k: 'Total de receitas', v: Number(s.income ?? 0) },
    { k: 'Total de despesas', v: Number(s.expense ?? 0) },
    { k: 'Saldo do livro-caixa', v: Number(s.balance ?? 0) },
    { k: 'Orçamento previsto (despesas)', v: Number(s.budget_total ?? 0) },
    { k: s.bank_balance === null ? 'Saldo bancário: não informado' : `Saldo bancário informado em ${String(s.bank_balance_date ?? '').split('-').reverse().join('/')}`, v: s.bank_balance === null ? null : Number(s.bank_balance) },
  ]);
  header(r);
  r.addRow([]);
  r.addRow([`Gerado em ${formatDateTime(new Date().toISOString())} por ${access.fullName}`]);

  // Lançamentos
  const l = wb.addWorksheet('Receitas e despesas');
  l.columns = [
    { header: 'Data', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Tipo', key: 'kind', width: 10 },
    { header: 'Categoria', key: 'cat', width: 24 },
    { header: 'Descrição', key: 'desc', width: 36 },
    { header: 'Equipe', key: 'team', width: 18 },
    { header: 'Responsável', key: 'resp', width: 20 },
    { header: 'Valor', key: 'amount', width: 14, style: { numFmt: MONEY } },
    { header: 'Situação', key: 'st', width: 12 },
    { header: 'Observações', key: 'notes', width: 36 },
  ];
  for (const e of entries ?? []) {
    l.addRow({
      date: toDate(e.entry_date),
      kind: e.kind === 'receita' ? 'Receita' : 'Despesa',
      cat: (e.category as unknown as { name: string } | null)?.name ?? '',
      desc: e.description,
      team: (e.team as unknown as { name: string } | null)?.name ?? '',
      resp: e.responsible ?? '',
      amount: e.kind === 'despesa' ? -Number(e.amount) : Number(e.amount),
      st: e.cancelled_at ? 'Cancelado' : 'Válido',
      notes: e.cancelled_at ? `Cancelado: ${e.cancel_reason ?? ''}` : e.notes ?? '',
    });
  }
  header(l);

  // Pagamentos
  const p = wb.addWorksheet('Pagamentos dos servos');
  p.columns = [
    { header: 'Nome', key: 'name', width: 32 },
    { header: 'Equipe', key: 'team', width: 18 },
    { header: 'Situação', key: 'st', width: 20 },
    { header: 'Valor combinado', key: 'exp', width: 16, style: { numFmt: MONEY } },
    { header: 'Valor pago', key: 'paid', width: 14, style: { numFmt: MONEY } },
    { header: 'Data', key: 'date', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Forma', key: 'method', width: 14 },
  ];
  const rows = (payments ?? [])
    .map((m) => ({
      name: (m.person as unknown as { full_name: string } | null)?.full_name ?? '',
      team: (m.team as unknown as { name: string } | null)?.name ?? '',
      st: PAYMENT_STATUS[m.payment_status]?.label ?? m.payment_status,
      exp: m.payment_expected !== null ? Number(m.payment_expected) : null,
      paid: m.payment_paid !== null ? Number(m.payment_paid) : null,
      date: toDate(m.payment_date),
      method: m.payment_method ? PAYMENT_METHOD[m.payment_method] : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  p.addRows(rows);
  header(p);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="financeiro-${todayISO()}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
