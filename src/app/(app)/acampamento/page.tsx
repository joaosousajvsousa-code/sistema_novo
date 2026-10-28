import type { Metadata } from 'next';
import { requirePerm } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Panel, Badge } from '@/components/ui/layout';
import { CAMP_STATUS } from '@/lib/labels';
import { formatDateRange } from '@/lib/format';
import { ArchiveCampForm, CampForm, type CampData } from './CampForm';

export const metadata: Metadata = { title: 'Acampamento' };

export default async function AcampamentoPage() {
  await requirePerm('acampamento.gerenciar');
  const supabase = createClient();
  const [{ data: camp }, { data: past }] = await Promise.all([
    supabase
      .from('camps')
      .select('id, name, description, start_date, end_date, location, responsaveis, status, shirt_sizes, signup_fields, privacy_notice, operational_notes')
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('camps').select('id, name, status, start_date, end_date, archived_at').eq('is_active', false).order('created_at', { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        title={camp ? 'Acampamento' : 'Cadastrar acampamento'}
        description={camp ? 'Dados e configurações do acampamento ativo.' : 'Nenhum acampamento ativo. Cadastre o próximo para começar.'}
      />
      <div className="space-y-5">
        <Panel>
          <CampForm camp={camp as CampData | null} />
        </Panel>
        {camp ? (
          <Panel title="Encerrar o ciclo" description="Depois do evento, arquive o acampamento para liberar o cadastro do próximo.">
            <ArchiveCampForm id={camp.id} />
          </Panel>
        ) : null}
        {past?.length ? (
          <Panel title="Acampamentos anteriores">
            <ul className="divide-y divide-pedra-100">
              {past.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-xs text-pedra-500">{formatDateRange(p.start_date, p.end_date) || 'Sem datas'}</p>
                  </div>
                  <Badge tone={CAMP_STATUS[p.status]?.tone}>{CAMP_STATUS[p.status]?.label ?? p.status}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
