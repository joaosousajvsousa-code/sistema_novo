import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { campEditable, getActiveCamp } from '@/lib/camp';
import { PageHeader, Panel, Notice } from '@/components/ui/layout';
import { NewEncontristaForm } from '../EncontristaForm';

export const metadata: Metadata = { title: 'Cadastrar recruta' };

export default async function NovoEncontristaPage({ searchParams }: { searchParams: { salvo?: string } }) {
  await requirePerm('encontristas.editar');
  const camp = await getActiveCamp();
  if (!camp || !campEditable(camp)) redirect('/encontristas');
  return (
    <>
      <PageHeader
        title="Cadastrar recruta"
        description="Transcrição da ficha física. A tropa é definida depois, na distribuição."
        back={{ href: '/encontristas', label: 'Recrutas' }}
      />
      {searchParams.salvo ? (
        <Notice tone="ok" className="mb-5">
          Ficha salva. Pode cadastrar a próxima.
        </Notice>
      ) : null}
      <Panel>
        <NewEncontristaForm key={searchParams.salvo ?? 'novo'} sizes={camp.shirt_sizes} />
      </Panel>
    </>
  );
}
