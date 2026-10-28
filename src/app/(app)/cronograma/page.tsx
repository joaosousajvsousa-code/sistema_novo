import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, ClipboardPaste, MapPin, Pencil, Plus, User } from 'lucide-react';
import { can, requireAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, EmptyState, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TIME_ZONE } from '@/config/app';
import {
  computeSchedule,
  dayKey,
  formatDayLabel,
  formatDelay,
  formatDuration,
  formatTime,
  minutesBetween,
  type ScheduleItem,
} from '@/lib/schedule';
import { AutoRefresh, ResetOriginalForm, ShiftForm, StatusButton, TickButton } from './CronogramaForms';

export const metadata: Metadata = { title: 'Cronograma' };
export const dynamic = 'force-dynamic';

const STATUS: Record<ScheduleItem['status'], { label: string; tone: 'neutral' | 'cirio' | 'ok' | 'erro' }> = {
  agendada: { label: 'Agendado', tone: 'neutral' },
  em_andamento: { label: 'Em andamento', tone: 'cirio' },
  concluida: { label: 'Concluído', tone: 'ok' },
  cancelada: { label: 'Cancelado', tone: 'neutral' },
};

type Event = {
  id: number;
  item_title: string;
  action: string;
  from_status: ScheduleItem['status'] | null;
  to_status: ScheduleItem['status'] | null;
  minutes: number | null;
  note: string | null;
  created_at: string;
  user: { full_name: string } | null;
};

function describeEvent(e: Event) {
  if (e.action === 'status' && e.to_status) {
    const verb = { em_andamento: 'iniciou', concluida: 'concluiu', cancelada: 'cancelou', agendada: 'reabriu' }[e.to_status];
    return `${verb} “${e.item_title}”`;
  }
  if (e.action === 'ajuste') {
    return e.minutes ? `ajustou os horários a partir de “${e.item_title}” em ${e.minutes > 0 ? '+' : ''}${e.minutes} min` : e.note ?? 'ajustou os horários';
  }
  if (e.action === 'criacao') return `adicionou “${e.item_title}”`;
  if (e.action === 'edicao') return `editou “${e.item_title}”`;
  if (e.action === 'exclusao') return `excluiu “${e.item_title}”`;
  return e.item_title;
}

function delayTone(min: number) {
  if (min >= 15) return 'erro' as const;
  if (min >= 5) return 'aviso' as const;
  return 'ok' as const;
}

export default async function CronogramaPage({ searchParams }: { searchParams: { colados?: string } }) {
  const access = await requireAccess();
  const camp = await getActiveCamp();
  if (!camp) return <Notice tone="erro">Acampamento não encontrado.</Notice>;
  const manage = can(access, 'programacao.gerenciar') && campEditable(camp);

  const supabase = createClient();
  const [{ data: rows, error }, { data: events }] = await Promise.all([
    supabase
      .from('schedule_items')
      .select('id, title, description, location, responsible, planned_start, planned_end, original_start, original_end, sort_order, status, actual_start, actual_end, notes')
      .eq('camp_id', camp.id),
    supabase
      .from('schedule_events')
      .select('id, item_title, action, from_status, to_status, minutes, note, created_at, user:profiles!schedule_events_user_id_fkey(full_name)')
      .eq('camp_id', camp.id)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);
  const state = computeSchedule((rows ?? []) as ScheduleItem[]);
  const renderedAt = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  const { current, next, delay, overrun, progress } = state;

  const days = new Map<string, ScheduleItem[]>();
  for (const i of state.items) {
    const k = dayKey(i.planned_start);
    days.set(k, [...(days.get(k) ?? []), i]);
  }
  const anyShifted = state.items.some((i) => i.status === 'agendada' && (i.planned_start !== i.original_start || i.planned_end !== i.original_end));

  return (
    <>
      <PageHeader
        title="Cronograma"
        description={<AutoRefresh renderedAt={renderedAt} />}
        actions={
          manage ? (
            <>
              <ButtonLink href="/cronograma/colar" variant="secondary">
                <ClipboardPaste className="h-4 w-4" /> Colar cronograma
              </ButtonLink>
              <ButtonLink href="/cronograma/nova">
                <Plus className="h-4 w-4" /> Adicionar momento
              </ButtonLink>
            </>
          ) : null
        }
      />

      {searchParams.colados ? (
        <Notice tone="ok" className="mb-5">
          {Number(searchParams.colados) || 0} momento(s) adicionado(s) ao cronograma.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="erro">Não foi possível carregar o cronograma. Verifique a conexão.</Notice>
      ) : !state.items.length ? (
        <div className="rounded-lg border border-pedra-200 bg-white">
          <EmptyState
            icon={<CalendarClock className="h-8 w-8" />}
            title="Nenhum momento no cronograma"
            description={manage ? 'Monte o cronograma colando a lista completa ou adicionando um momento por vez. Durante o acampamento, tique cada momento quando ele começar.' : 'A coordenação ainda não montou o cronograma.'}
            action={manage ? <ButtonLink href="/cronograma/colar">Colar o cronograma</ButtonLink> : null}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Agora */}
          <section aria-label="Agora" className="overflow-hidden rounded-lg bg-manto text-white">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-manto-100/80">{current ? 'Agora' : 'Nenhum momento em andamento'}</p>
                {current || delay > 0 ? (
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-bold',
                      delayTone(delay) === 'erro' ? 'bg-erro text-white' : delayTone(delay) === 'aviso' ? 'bg-cirio text-manto-800' : 'bg-white/15 text-white',
                    )}
                  >
                    {formatDelay(delay)}
                  </span>
                ) : null}
              </div>
              {current ? (
                <>
                  <h2 className="mt-1 text-2xl text-white sm:text-[1.75rem]">{current.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-manto-100/85">
                    {current.location ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" aria-hidden /> {current.location}
                      </span>
                    ) : null}
                    {current.responsible ? (
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-4 w-4" aria-hidden /> {current.responsible}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-manto-100/70">Começou</dt>
                      <dd className="font-bold">{formatTime(current.actual_start)}</dd>
                      <dd className="text-xs text-manto-100/70">previsto {formatTime(current.planned_start)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-manto-100/70">Término previsto</dt>
                      <dd className="font-bold">{formatTime(current.planned_end)}</dd>
                      {overrun > 0 ? <dd className="text-xs text-cirio">passou {overrun} min</dd> : null}
                    </div>
                    <div>
                      <dt className="text-xs text-manto-100/70">Próximo</dt>
                      <dd className="truncate font-bold">{next ? next.title : '—'}</dd>
                      {next ? (
                        <dd className="text-xs text-manto-100/70">
                          {state.projectedStart[next.id] ? `previsto ${formatTime(state.projectedStart[next.id])}` : formatTime(next.planned_start)}
                        </dd>
                      ) : null}
                    </div>
                  </dl>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
                    <div className={cn('h-full rounded-full', progress > 1 ? 'bg-erro' : 'bg-cirio')} style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
                  </div>
                </>
              ) : next ? (
                <>
                  <h2 className="mt-1 text-xl text-white">Próximo: {next.title}</h2>
                  <p className="mt-1 text-sm text-manto-100/85">
                    Previsto para {formatDayLabel(next.planned_start).toLowerCase()}, {formatTime(next.planned_start)}
                    {next.location ? ` · ${next.location}` : ''}
                  </p>
                </>
              ) : (
                <h2 className="mt-1 text-xl text-white">Cronograma concluído</h2>
              )}
            </div>
            {manage && (current || next) ? (
              <div className="grid gap-2 border-t border-white/10 bg-manto-700 p-3 sm:flex sm:justify-end">
                {current ? (
                  <StatusButton id={current.id} status="concluida" label="Concluir o atual" icon="check" variant="secondary" size="lg" />
                ) : null}
                {next ? (
                  <StatusButton
                    id={next.id}
                    status="em_andamento"
                    label={`Começar: ${next.title}`}
                    icon="play"
                    variant="primary"
                    size="lg"
                    className="[&_button]:bg-cirio [&_button]:text-manto-800 [&_button:hover]:bg-[#D2AE62]"
                    confirm={current ? `Começar “${next.title}”? “${current.title}” será concluído agora.` : undefined}
                  />
                ) : null}
              </div>
            ) : null}
          </section>

          {manage && (current ?? next) ? (
            <Panel
              title="Ajustar os próximos horários"
              description={
                delay > 0
                  ? `O cronograma está com ${formatDelay(delay)}. Empurre os próximos momentos para refletir isso; o cronograma original continua guardado.`
                  : 'Use para empurrar (número positivo) ou adiantar (negativo) os próximos momentos. O cronograma original continua guardado.'
              }
            >
              <ShiftForm id={(current ?? next)!.id} suggested={Math.max(delay, 0)} />
            </Panel>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              {Array.from(days.entries()).map(([day, list]) => (
                <Panel key={day} title={formatDayLabel(list[0].planned_start)} bodyClassName="p-0 sm:p-0">
                  <ol className="divide-y divide-pedra-100">
                    {list.map((i) => {
                      const st = STATUS[i.status];
                      const moved = i.planned_start !== i.original_start;
                      const startDiff = minutesBetween(i.planned_start, i.actual_start);
                      const projected = state.projectedStart[i.id];
                      return (
                        <li key={i.id} className={cn('grid grid-cols-[44px_56px_1fr] items-start gap-3 px-3 py-3 sm:px-5', i.status === 'em_andamento' && 'bg-cirio-50', i.status === 'cancelada' && 'opacity-60')}>
                          <TickButton id={i.id} title={i.title} status={i.status} canManage={manage} />
                          <div className="pt-1 text-sm">
                            <p className={cn('font-bold', i.status === 'cancelada' && 'line-through')}>{formatTime(i.planned_start)}</p>
                            <p className="text-xs text-pedra-500">{formatTime(i.planned_end)}</p>
                            {moved ? <p className="text-xs text-pedra-400 line-through" title="Horário original">{formatTime(i.original_start)}</p> : null}
                          </div>
                          <div className="min-w-0 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn('font-bold', i.status === 'concluida' && 'text-pedra-500')}>{i.title}</span>
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </div>
                            {i.location || i.responsible ? (
                              <p className="mt-0.5 text-xs text-pedra-500">{[i.location, i.responsible].filter(Boolean).join(' · ')}</p>
                            ) : null}
                            {i.actual_start ? (
                              <p className="mt-0.5 text-xs text-pedra-600">
                                Real: {formatTime(i.actual_start)}
                                {i.actual_end ? ` às ${formatTime(i.actual_end)}` : ''}
                                {startDiff ? ` · começou ${formatDuration(startDiff)} ${startDiff > 0 ? 'depois' : 'antes'}` : ''}
                              </p>
                            ) : projected ? (
                              <p className="mt-0.5 text-xs font-bold text-aviso">Previsão com o atraso: {formatTime(projected)}</p>
                            ) : null}
                            {manage ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {i.status === 'agendada' || i.status === 'em_andamento' ? (
                                  <StatusButton id={i.id} status="cancelada" label="Cancelar" icon="x" size="sm" variant="quiet-danger" confirm={`Cancelar “${i.title}”?`} />
                                ) : null}
                                {i.status === 'concluida' || i.status === 'cancelada' ? (
                                  <StatusButton id={i.id} status="agendada" label="Reabrir" icon="undo" size="sm" variant="ghost" confirm="Voltar este momento para agendado? Os horários reais serão apagados." />
                                ) : null}
                                <Link href={`/cronograma/${i.id}/editar`} className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-bold text-manto hover:bg-manto-50">
                                  <Pencil className="h-4 w-4" /> Editar
                                </Link>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>
              ))}
              {manage && anyShifted ? (
                <div className="flex justify-end">
                  <ResetOriginalForm />
                </div>
              ) : null}
            </div>
            <Panel title="Atualizações" description="Quem mudou o cronograma e quando." bodyClassName="p-0 sm:p-0">
              {!events?.length ? (
                <p className="px-4 py-4 text-sm text-pedra-500 sm:px-5">Nenhuma atualização ainda.</p>
              ) : (
                <ol className="divide-y divide-pedra-100">
                  {(events as unknown as Event[]).map((e) => (
                    <li key={e.id} className="px-4 py-2.5 text-sm sm:px-5">
                      <p>
                        <strong>{e.user?.full_name?.split(' ')[0] ?? 'Sistema'}</strong> {describeEvent(e)}
                      </p>
                      <p className="text-xs text-pedra-500">{formatDateTime(e.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
