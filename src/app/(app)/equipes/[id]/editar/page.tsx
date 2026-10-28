import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel } from '@/components/ui/layout';
import { DeleteTeamForm, TeamForm } from '../../TeamForm';

export const metadata: Metadata = { title: 'Editar equipe' };

export default async function EditarEquipePage({ params }: { params: { id: string } }) {
  await requirePerm('equipes.gerenciar');
  const supabase = createClient();
  const { data: team } = await supabase
    .from('service_teams_overview')
    .select('id, camp_id, name, description, capacity, status, internal_notes, occupied')
    .eq('id', params.id)
    .maybeSingle();
  if (!team) notFound();
  const camp = await getActiveCamp();
  if (camp?.id !== team.camp_id || !campEditable(camp)) redirect(`/equipes/${team.id}`);
  const { count } = await supabase.from('service_team_memberships').select('id', { count: 'exact', head: true }).eq('team_id', team.id);

  return (
    <>
      <PageHeader title={`Editar ${team.name}`} back={{ href: `/equipes/${team.id}`, label: team.name }} />
      <div className="space-y-5">
        <Panel>
          <TeamForm team={team} occupied={team.occupied} />
        </Panel>
        {(count ?? 0) === 0 ? (
          <Panel title="Excluir equipe" description="Possível só enquanto não há nenhuma inscrição.">
            <DeleteTeamForm id={team.id} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
