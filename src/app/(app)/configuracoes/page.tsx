import type { Metadata } from 'next';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { CampForm, type CampData } from './CampForm';

export const metadata: Metadata = { title: 'Configurações' };

export default async function ConfiguracoesPage() {
  await requirePerm('acampamento.gerenciar');
  const active = await getActiveCamp();
  const supabase = createClient();
  const { data: camp } = active
    ? await supabase
        .from('camps')
        .select('id, name, description, start_date, end_date, location, responsaveis, status, shirt_sizes, signup_fields, privacy_notice, operational_notes')
        .eq('id', active.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader title="Configurações" description="Dados do acampamento, camisetas e o formulário de inscrição dos soldados/servos." />
      {camp ? (
        <Panel>
          <CampForm camp={camp as CampData} />
        </Panel>
      ) : (
        <Notice tone="erro" title="Não foi possível carregar as configurações">
          Confira se a variável SUPABASE_SERVICE_ROLE_KEY está cadastrada na Vercel e recarregue a página.
        </Notice>
      )}
    </>
  );
}
