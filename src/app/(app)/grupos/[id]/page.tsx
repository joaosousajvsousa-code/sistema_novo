import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Badge, EmptyState } from '@/components/ui/layout';
import { ButtonLink } from '@/components/ui/button';
import { ageOn, formatPhone } from '@/lib/format';
import { DeleteGroupForm, EditGroupForm, type GroupData } from '../GroupForms';

export const metadata: Metadata = { title: 'Grupo' };

export default async function GrupoPage({ params }: { params: { id: string } }) {
  const access = await requirePerm('encontristas.ver', 'grupos.gerenciar');
  const supabase = createClient();
  const { data: g } = await supabase
    .from('participant_groups_overview')
    .select('id, camp_id, name, description, responsaveis, capacity, notes, occupied')
    .eq('id', params.id)
    .maybeSingle();
  if (!g) notFound();
  const camp = await getActiveCamp();
  const manage = can(access, 'grupos.gerenciar') && camp?.id === g.camp_id && campEditable(camp);
  const canSee = can(access, 'encontristas.ver');
  const { data: members } = canSee
    ? await supabase.from('encontristas_list').select('id, full_name, phone, birth_date, shirt_size').eq('group_id', g.id).eq('status', 'ativo').order('full_name')
    : { data: null };

  return (
    <>
      <PageHeader
        title={g.name}
        description={[g.responsaveis ? `Responsáveis: ${g.responsaveis}` : null, `${g.occupied}${g.capacity ? ` de ${g.capacity}` : ''} integrante(s)`]
          .filter(Boolean)
          .join(' · ')}
        back={{ href: '/grupos', label: 'Grupos' }}
        actions={
          manage ? (
            <ButtonLink href="/grupos/distribuir" variant="secondary">
              Adicionar encontristas
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel title="Integrantes" bodyClassName="p-0 sm:p-0">
          {!canSee ? (
            <EmptyState title="Sem permissão para ver os integrantes" />
          ) : !members?.length ? (
            <EmptyState title="Nenhum integrante ainda" description={manage ? 'Use “Distribuir encontristas” para adicionar pessoas.' : undefined} />
          ) : (
            <ul className="divide-y divide-pedra-100">
              {members.map((m) => {
                const age = ageOn(m.birth_date);
                return (
                  <li key={m.id}>
                    <Link href={`/encontristas/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-pedra-100/60 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{m.full_name}</p>
                        <p className="text-xs text-pedra-500">
                          {age !== null ? `${age} anos` : ''}
                          {m.phone ? `${age !== null ? ' · ' : ''}${formatPhone(m.phone)}` : ''}
                        </p>
                      </div>
                      {m.shirt_size ? <Badge>{m.shirt_size}</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <div className="space-y-5">
          {manage ? (
            <Panel title="Dados do grupo">
              <EditGroupForm g={g as GroupData} />
            </Panel>
          ) : (
            <Panel title="Sobre o grupo">
              <p className="whitespace-pre-line text-sm">{g.description || 'Sem descrição.'}</p>
              {g.notes ? <p className="mt-3 whitespace-pre-line text-sm text-pedra-600">{g.notes}</p> : null}
            </Panel>
          )}
          {manage && g.occupied === 0 ? (
            <Panel title="Excluir grupo">
              <DeleteGroupForm id={g.id} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
