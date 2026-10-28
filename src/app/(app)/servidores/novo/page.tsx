import type { Metadata } from 'next';
import { requireAccess, can } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { redirect } from 'next/navigation';
import { NewServidorForm } from '../ServidorForm';

export const metadata: Metadata = { title: 'Cadastrar servidor' };

export default async function NovoServidorPage({ searchParams }: { searchParams: { equipe?: string } }) {
  const access = await requireAccess();
  const camp = await getActiveCamp();
  if (!camp || !campEditable(camp)) redirect('/servidores');
  const all = can(access, 'servidores.editar_todos') || can(access, 'equipes.gerenciar');
  if (!all && !access.coordinatedTeamIds.length) redirect('/sem-permissao');

  const supabase = createClient();
  let q = supabase.from('service_teams_overview').select('id, name, available').eq('camp_id', camp.id).neq('status', 'inativa').order('name');
  if (!all) q = q.in('id', access.coordinatedTeamIds);
  const { data: teams } = await q;

  return (
    <>
      <PageHeader
        title="Cadastrar servidor"
        description="Para quem não consegue usar o link. As mesmas regras de vagas e duplicidade valem aqui."
        back={{ href: '/servidores', label: 'Servidores' }}
      />
      {!teams?.length ? (
        <Notice>Nenhuma equipe disponível para cadastro.</Notice>
      ) : (
        <Panel>
          <NewServidorForm
            teams={teams}
            defaultTeam={teams.some((t) => t.id === searchParams.equipe) ? searchParams.equipe : undefined}
            sizes={camp.shirt_sizes}
            fields={camp.signup_fields}
          />
        </Panel>
      )}
    </>
  );
}
