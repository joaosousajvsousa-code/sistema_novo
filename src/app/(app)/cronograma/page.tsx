import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, ChevronDown, ClipboardPaste, Clock, MapPin, Pencil, Plus, SlidersHorizontal, User } from 'lucide-react';
import { can, requireAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Badge, EmptyState, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
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
  const { data: rows, error } = await supabase
    .from('schedule_items')
    .select('id, title, description, location, responsible, planned_start, planned_end, original_start, original_end, sort_order, status, actual_start, actual_end, notes')
    .eq('camp_id', camp.id);
  const state = computeSchedule((rows ?? []) as ScheduleItem[]);
  const renderedAt = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
  const { current, next, delay, overrun } = state;

  const days = new Map<string, ScheduleItem[]>();
  for (const i of state.items) {
    const k = dayKey(i.planned_start);
    days.set(k, [...(days.get(k) ?? []), i]);
  }
  const active = state.items.filter((i) => i.status !== 'cancelada');
  const doneCount = active.filter((i) => i.status === 'concluida').length;
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
        <div className="overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-22px_rgba(21,32,46,0.45)]">
          <EmptyState
            icon={<CalendarClock className="h-8 w-8" />}
            title="Nenhum momento no cronograma"
            description={manage ? 'Monte o cronograma colando a lista completa ou adicionando um momento por vez. Durante o acampamento, tique cada momento quando ele começar.' : 'A coordenação ainda não montou o cronograma.'}
            action={manage ? <ButtonLink href="/cronograma/colar">Colar o cronograma</ButtonLink> : null}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Agora: mesmo acabamento da tela de login */}
          <section aria-label="Agora" className="relative isolate overflow-hidden rounded-2xl bg-manto-800 text-white shadow-[0_18px_40px_-18px_rgba(20,28,12,0.7)]">
            <div aria-hidden className="absolute inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center opacity-90" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_0%,rgba(200,161,101,0.28),transparent_55%)]" />
            <div aria-hidden className="h-1.5 bg-[repeating-linear-gradient(135deg,#C8A165_0_10px,#252E1A_10px_20px)]" />
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cirio-50 ring-1 ring-white/15">
                  {current ? (
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cirio opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cirio" />
                    </span>
                  ) : null}
                  {current ? 'Agora' : next ? 'A seguir' : 'Encerrado'}
                </span>
                {current || delay > 0 ? (
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-bold',
                      delayTone(delay) === 'erro' ? 'bg-erro text-white' : delayTone(delay) === 'aviso' ? 'bg-cirio text-manto-800' : 'bg-white/10 text-white ring-1 ring-white/15',
                    )}
                  >
                    {formatDelay(delay)}
                  </span>
                ) : null}
              </div>

              {current ? (
                <>
                  <h2 className="mt-4 text-3xl leading-tight text-white sm:text-4xl">{current.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-manto-100/85">
                    {current.location ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-cirio" aria-hidden /> {current.location}
                      </span>
                    ) : null}
                    {current.responsible ? (
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-4 w-4 text-cirio" aria-hidden /> {current.responsible}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-xl bg-black/20 text-sm ring-1 ring-white/10 backdrop-blur-sm">
                    <div className="p-3 sm:p-4">
                      <dt className="text-[11px] uppercase tracking-wider text-manto-100/60">Começou</dt>
                      <dd className="mt-0.5 text-xl font-bold sm:text-2xl">{formatTime(current.actual_start)}</dd>
                      <dd className="text-xs text-manto-100/60">previsto {formatTime(current.planned_start)}</dd>
                    </div>
                    <div className="p-3 sm:p-4">
                      <dt className="text-[11px] uppercase tracking-wider text-manto-100/60">Termina</dt>
                      <dd className="mt-0.5 text-xl font-bold sm:text-2xl">{formatTime(current.planned_end)}</dd>
                      {overrun > 0 ? <dd className="text-xs font-bold text-cirio">passou {overrun} min</dd> : <dd className="text-xs text-manto-100/60">previsto</dd>}
                    </div>
                    <div className="min-w-0 p-3 sm:p-4">
                      <dt className="text-[11px] uppercase tracking-wider text-manto-100/60">Próximo</dt>
                      <dd className="mt-0.5 truncate text-base font-bold sm:text-lg">{next ? next.title : '—'}</dd>
                      {next ? (
                        <dd className="text-xs text-manto-100/60">
                          {state.projectedStart[next.id] ? `previsto ${formatTime(state.projectedStart[next.id])}` : formatTime(next.planned_start)}
                        </dd>
                      ) : null}
                    </div>
                  </dl>
                </>
              ) : next ? (
                <>
                  <h2 className="mt-4 text-3xl leading-tight text-white sm:text-4xl">{next.title}</h2>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-manto-100/85">
                    <Clock className="h-4 w-4 text-cirio" aria-hidden />
                    {formatDayLabel(next.planned_start)}, {formatTime(next.planned_start)}
                    {next.location ? ` · ${next.location}` : ''}
                  </p>
                </>
              ) : (
                <h2 className="mt-4 text-3xl leading-tight text-white sm:text-4xl">Cronograma concluído</h2>
              )}

              <div className="mt-6 flex items-center gap-3 text-xs text-manto-100/70">
                <div className="flex flex-1 gap-1" aria-hidden>
                  {active.map((i) => (
                    <span
                      key={i.id}
                      className={cn('h-1 flex-1 rounded-full', i.status === 'concluida' ? 'bg-cirio' : i.status === 'em_andamento' ? 'bg-white' : 'bg-white/15')}
                    />
                  ))}
                </div>
                <span className="shrink-0 font-bold text-white">
                  {doneCount} de {active.length}
                </span>
                <span className="hidden shrink-0 sm:inline">momentos concluídos</span>
              </div>
            </div>
            {manage && (current || next) ? (
              <div className="grid gap-2 border-t border-white/10 bg-black/25 p-3 backdrop-blur-sm sm:flex sm:justify-end sm:px-5">
                {current ? (
                  <StatusButton
                    id={current.id}
                    status="concluida"
                    label="Concluir o atual"
                    icon="check"
                    variant="secondary"
                    size="lg"
                    className="[&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20"
                  />
                ) : null}
                {next ? (
                  <StatusButton
                    id={next.id}
                    status="em_andamento"
                    label={`Começar: ${next.title}`}
                    icon="play"
                    variant="primary"
                    size="lg"
                    className="[&_button]:bg-cirio [&_button]:text-manto-800 [&_button:hover]:bg-[#D4B37E]"
                    confirm={current ? `Começar “${next.title}”? “${current.title}” será concluído agora.` : undefined}
                  />
                ) : null}
              </div>
            ) : null}
          </section>

          {manage && (current ?? next) ? (
            <details open={delay >= 5 || undefined} className="group rounded-xl border border-pedra-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-manto-50 text-manto">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Ajustar os próximos horários</span>
                  <span className="block text-xs text-pedra-500">{delay > 0 ? `Está com ${formatDelay(delay)}. Empurre os próximos momentos.` : 'Empurre ou adiante os próximos momentos.'}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-pedra-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-pedra-100 px-4 py-4 sm:px-5">
                <p className="mb-3 text-xs text-pedra-500">Número positivo empurra, negativo adianta. O cronograma original continua guardado.</p>
                <ShiftForm id={(current ?? next)!.id} suggested={Math.max(delay, 0)} />
              </div>
            </details>
          ) : null}

          {Array.from(days.entries()).map(([day, list]) => {
            const dayActive = list.filter((i) => i.status !== 'cancelada');
            const dayDone = dayActive.filter((i) => i.status === 'concluida').length;
            return (
              <section key={day} aria-label={formatDayLabel(list[0].planned_start)}>
                <header className="mb-3 flex items-center gap-3">
                  <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-manto">{formatDayLabel(list[0].planned_start)}</h2>
                  <span aria-hidden className="h-px flex-1 bg-pedra-200" />
                  <span className="text-xs text-pedra-500">
                    {dayDone} de {dayActive.length} concluídos
                  </span>
                </header>
                <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[21px] before:top-6 before:w-0.5 before:bg-pedra-200">
                  {list.map((i) => {
                    const st = STATUS[i.status];
                    const moved = i.planned_start !== i.original_start;
                    const startDiff = minutesBetween(i.planned_start, i.actual_start);
                    const projected = state.projectedStart[i.id];
                    const live = i.status === 'em_andamento';
                    const done = i.status === 'concluida';
                    return (
                      <li key={i.id} className={cn('relative grid grid-cols-[44px_1fr] gap-3 sm:gap-4', i.status === 'cancelada' && 'opacity-60')}>
                        <div className="relative z-10 pt-3">
                          <TickButton id={i.id} title={i.title} status={i.status} canManage={manage} />
                        </div>
                        <article
                          className={cn(
                            'min-w-0 rounded-xl border bg-white transition-shadow',
                            live ? 'border-cirio shadow-[0_10px_30px_-12px_rgba(200,161,101,0.65)] ring-1 ring-cirio/40' : 'border-pedra-200 shadow-[0_1px_2px_rgba(21,32,46,0.04)] hover:shadow-[0_8px_24px_-14px_rgba(21,32,46,0.25)]',
                            done && 'bg-white/70',
                          )}
                        >
                          <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
                            <div className="w-[60px] shrink-0 sm:w-16">
                              <p className={cn('text-lg font-bold leading-none sm:text-xl', done ? 'text-pedra-400' : 'text-pedra-900', i.status === 'cancelada' && 'line-through')}>
                                {formatTime(i.planned_start)}
                              </p>
                              <p className="mt-1 whitespace-nowrap text-xs text-pedra-400">até {formatTime(i.planned_end)}</p>
                              {moved ? (
                                <p className="mt-0.5 text-[11px] text-pedra-400 line-through" title="Horário original">
                                  {formatTime(i.original_start)}
                                </p>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <h3 className={cn('text-base font-bold leading-snug', done ? 'text-pedra-500' : 'text-pedra-900')}>{i.title}</h3>
                                {i.status !== 'agendada' ? <Badge tone={st.tone}>{st.label}</Badge> : null}
                              </div>
                              {i.location || i.responsible ? (
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-pedra-500">
                                  {i.location ? (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5 text-cirio-700" aria-hidden /> {i.location}
                                    </span>
                                  ) : null}
                                  {i.responsible ? (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="h-3.5 w-3.5 text-cirio-700" aria-hidden /> {i.responsible}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              {i.actual_start ? (
                                <p className="mt-2 text-xs text-pedra-600">
                                  <span className="font-bold">Real:</span> {formatTime(i.actual_start)}
                                  {i.actual_end ? ` às ${formatTime(i.actual_end)}` : ''}
                                  {startDiff ? ` · começou ${formatDuration(startDiff)} ${startDiff > 0 ? 'depois' : 'antes'}` : ''}
                                </p>
                              ) : projected ? (
                                <p className="mt-2 inline-flex rounded-full bg-aviso-50 px-2 py-0.5 text-xs font-bold text-aviso">Previsão com o atraso: {formatTime(projected)}</p>
                              ) : null}
                            </div>
                          </div>
                          {manage ? (
                            <div className="flex flex-wrap justify-end gap-1 border-t border-pedra-100 px-2 py-1 sm:px-3">
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
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
          {manage && anyShifted ? (
            <div className="flex justify-end">
              <ResetOriginalForm />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
