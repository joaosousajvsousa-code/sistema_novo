'use client';

import { DateInput } from '@/components/ui/date-input';
import { ActionForm, Field, FormActions, SubmitButton } from '@/components/ui/form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { FormSection } from '@/components/ui/layout';
import { SignupFieldsEditor } from './SignupFieldsEditor';
import { saveCamp } from './actions';

export type CampData = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  responsaveis: string | null;
  status: string;
  shirt_sizes: string[];
  signup_fields: { label: string; type: 'text' | 'select'; required: boolean; options: string[] }[];
  privacy_notice: string | null;
  operational_notes: string | null;
  leaders_team_id: string | null;
};

const DEFAULT_PRIVACY =
  'Os dados informados serão usados apenas pela coordenação do acampamento para organizar as equipes de serviço, ' +
  'contato durante o evento e produção de camisetas. Eles não serão compartilhados com terceiros e podem ser corrigidos ' +
  'ou excluídos a pedido do titular junto à coordenação.';

export function CampForm({ camp, teams }: { camp: CampData; teams: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveCamp} className="space-y-6">
      <input type="hidden" name="id" value={camp.id} />
      <FormSection title="Dados do acampamento" description="Preencha quando estiverem definidos. Aparecem no topo do sistema e nos links de inscrição.">
        <Field label="Nome do acampamento" name="name" required className="sm:col-span-2">
          <Input defaultValue={camp.name ?? ''} />
        </Field>
        <Field label="Início" name="start_date">
          <DateInput defaultValue={camp.start_date ?? ''} />
        </Field>
        <Field label="Término" name="end_date">
          <DateInput defaultValue={camp.end_date ?? ''} />
        </Field>
        <Field label="Local" name="location" className="sm:col-span-2">
          <Input defaultValue={camp.location ?? ''} />
        </Field>
        <Field label="Responsáveis gerais" name="responsaveis" hint="Nomes de quem responde pelo acampamento." className="sm:col-span-2">
          <Input defaultValue={camp.responsaveis ?? ''} />
        </Field>
        <Field label="Descrição" name="description" className="sm:col-span-2">
          <Textarea defaultValue={camp.description ?? ''} />
        </Field>
        <Field label="Situação" name="status" hint="Os links de inscrição só aceitam cadastros com “Inscrições abertas”. “Encerrado” deixa tudo só para consulta." required>
          <Select defaultValue={camp.status ?? 'planejamento'}>
            <option value="planejamento">Planejamento</option>
            <option value="inscricoes_abertas">Inscrições abertas</option>
            <option value="em_andamento">Em andamento</option>
            <option value="encerrado">Encerrado</option>
          </Select>
        </Field>
      </FormSection>
      <FormSection title="Camisetas" description="Tamanhos oferecidos para soldados/servos e recrutas.">
        <Field label="Tamanhos" name="shirt_sizes" hint="Separados por vírgula, na ordem em que devem aparecer." required className="sm:col-span-2">
          <Input defaultValue={(camp.shirt_sizes ?? ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG']).join(', ')} />
        </Field>
      </FormSection>
      <FormSection title="Tenentes" description="Os tenentes das tropas são escolhidos entre os integrantes desta equipe.">
        <Field label="Equipe dos tenentes" name="leaders_team_id" hint="No automático, o sistema usa a equipe cujo nome começa com “Tenente”." className="sm:col-span-2">
          <Select defaultValue={camp.leaders_team_id ?? ''}>
            <option value="">Automático (equipe “Tenente”)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>
      <FormSection title="Inscrição dos soldados/servos" description="Perguntas extras exibidas no link de inscrição de todas as equipes.">
        <SignupFieldsEditor initial={camp.signup_fields ?? []} />
        <Field label="Aviso de privacidade" name="privacy_notice" hint="Aparece no formulário, junto do pedido de consentimento." className="sm:col-span-2">
          <Textarea rows={4} defaultValue={camp.privacy_notice ?? DEFAULT_PRIVACY} />
        </Field>
      </FormSection>
      <FormSection title="Informações operacionais" description="Anotações internas, visíveis só para quem configura o acampamento.">
        <Field label="Anotações" name="operational_notes" className="sm:col-span-2">
          <Textarea rows={4} defaultValue={camp.operational_notes ?? ''} />
        </Field>
      </FormSection>
      <FormActions>
        <SubmitButton>Salvar configurações</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
