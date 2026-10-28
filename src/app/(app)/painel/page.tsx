import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { can, canSeeTeams, requireAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Panel, EmptyState, Notice } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { TIME_ZONE } from '@/config/app';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Painel' };

type Summary = {
  camp: { id: string; name: string; status: string; start_date: string | null; end_date: string | null; location: string | null } | null;
  scope_all_teams?: boolean;
  teams?: number;
  capacity?: number;
  servidores?: number;
  can_see_encontristas?: boolean;
  encontristas?: number;
  encontristas_sem_grupo?: number;
  grupos?: number;
  alerts?: { level: 'warning' | 'info'; kind: string; text: string; href: string }[];
};

function greeting() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function Stat({ label, value, detail, href }: { label: string; value: React.ReactNode; detail?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-pedra-500">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none text-pedra-900">{value}</p>
      {detail ? <p className="mt-1.5 text-xs text-pedra-500">{detail}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="block px-4 py-4 hover:bg-pedra-100/60 sm:px-5">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-4 sm:px-5">{body}</div>
  );
}

export default async function PainelPage() {
  const access = await requireAccess();
  const supabase = createClient();
  const { data, error } = await supabase.rpc('dashboard_summary');
  const s = (data ?? { camp: null }) as Summary;
  const firstName = access.fullName.split(' ')[0];
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (error) {
    return (
      <Notice tone="erro" title="Não foi possível carregar o painel">
        Verifique a conexão e recarregue a página.
      </Notice>
    );
  }

  if (!s.camp) {
    return (
      <div className="rounded-lg border border-pedra-200 bg-white">
        <EmptyState
          title="Nenhum acampamento ativo"
          description={
            can(access, 'acampamento.gerenciar')
              ? 'Cadastre o acampamento para criar equipes, links de inscrição e a lista de encontristas.'
              : 'Assim que a coordenação cadastrar o acampamento, as informações aparecem aqui.'
          }
          action={can(access, 'acampamento.gerenciar') ? <ButtonLink href="/acampamento">Cadastrar acampamento</ButtonLink> : null}
        />
      </div>
    );
  }

  const [{ data: teams }] = await Promise.all([
    canSeeTeams(access)
      ? supabase
          .from('service_teams_overview')
          .select('id, name, capacity, occupied, available, status')
          .eq('camp_id', s.camp.id)
          .neq('status', 'inativa')
          .order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; capacity: number; occupied: number; available: number; status: string }[] }),
  ]);

  const capacity = s.capacity ?? 0;
  const servidores = s.servidores ?? 0;
  const alerts = s.alerts ?? [];
  const showTeamsStat = canSeeTeams(access);

  return (
    <>
      <div className="mb-6">
        <p className="text-sm text-pedra-500 first-letter:uppercase">{dateLabel}</p>
        <h1 className="text-xl sm:text-2xl">
          {greeting()}, {firstName}
        </h1>
      </div>

      <section aria-label="Indicadores" className="mb-5 grid grid-cols-2 divide-pedra-200 overflow-hidden rounded-lg border border-pedra-200 bg-white max-sm:[&>*:nth-child(n+3)]:border-t sm:flex sm:divide-x">
        {showTeamsStat ? (
          <>
            <div className="sm:flex-1">
              <Stat
                label={s.scope_all_teams ? 'Servidores inscritos' : 'Servidores nas suas equipes'}
                value={servidores}
                detail={capacity ? `${Math.max(capacity - servidores, 0)} vaga(s) livre(s) de ${capacity}` : 'Sem vagas definidas'}
                href="/servidores"
              />
            </div>
            <div className="max-sm:border-l sm:flex-1">
              <Stat label={s.scope_all_teams ? 'Equipes de serviço' : 'Equipes que você coordena'} value={s.teams ?? 0} href="/equipes" />
            </div>
          </>
        ) : null}
        {s.can_see_encontristas ? (
          <>
            <div className={cn('sm:flex-1', !showTeamsStat ? '' : '')}>
              <Stat label="Encontristas" value={s.encontristas ?? 0} detail={`${s.grupos ?? 0} grupo(s)`} href="/encontristas" />
            </div>
            <div className="max-sm:border-l sm:flex-1">
              <Stat
                label="Sem grupo"
                value={s.encontristas_sem_grupo ?? 0}
                detail={(s.encontristas_sem_grupo ?? 0) > 0 ? 'Aguardando distribuição' : 'Todos distribuídos'}
                href="/grupos/distribuir"
              />
            </div>
          </>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel title="Alertas" description="Calculados a partir dos cadastros atuais." bodyClassName="p-0 sm:p-0">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-5 text-sm text-pedra-600 sm:px-5">
              <CheckCircle2 className="h-5 w-5 text-ok" aria-hidden />
              Nada pendente por aqui.
            </div>
          ) : (
            <ul className="divide-y divide-pedra-100">
              {alerts.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <Link href={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-pedra-100/60 sm:px-5">
                    {a.level === 'warning' ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-aviso" aria-label="Atenção" />
                    ) : (
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-manto" aria-label="Informação" />
                    )}
                    <span className="flex-1 text-sm">{a.text}</span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-pedra-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {showTeamsStat ? (
          <Panel title="Vagas por equipe" bodyClassName="p-0 sm:p-0">
            {!teams?.length ? (
              <EmptyState
                title="Nenhuma equipe ainda"
                action={can(access, 'equipes.gerenciar') ? <ButtonLink href="/equipes/nova" size="sm">Criar equipe</ButtonLink> : null}
              />
            ) : (
              <ul className="divide-y divide-pedra-100">
                {teams.map((t) => {
                  const pct = t.capacity ? Math.min(100, Math.round((t.occupied / t.capacity) * 100)) : 0;
                  return (
                    <li key={t.id}>
                      <Link href={`/equipes/${t.id}`} className="block px-4 py-3 hover:bg-pedra-100/60 sm:px-5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-bold">{t.name}</span>
                          <span className="shrink-0 text-pedra-600">
                            {t.occupied}/{t.capacity}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pedra-100" aria-hidden>
                          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-cirio' : pct >= 90 ? 'bg-aviso' : 'bg-manto')} style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </>
  );
}
