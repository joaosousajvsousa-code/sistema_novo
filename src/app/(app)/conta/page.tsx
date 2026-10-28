import type { Metadata } from 'next';
import { requireAccess } from '@/lib/auth';
import { PageHeader, Panel, DataList, Badge } from '@/components/ui/layout';
import { ROLE_LABEL } from '@/lib/labels';
import { ChangePasswordForm } from '@/app/trocar-senha/PasswordForms';

export const metadata: Metadata = { title: 'Minha conta' };

export default async function ContaPage() {
  const access = await requireAccess();
  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Dados de acesso">
          <DataList
            items={[
              { label: 'Nome', value: access.fullName },
              { label: 'Usuário', value: `@${access.username}` },
              {
                label: 'Perfis',
                value: access.roles.length ? (
                  <span className="flex flex-wrap gap-1">
                    {access.roles.map((r) => (
                      <Badge key={r} tone="manto">
                        {ROLE_LABEL[r] ?? r}
                      </Badge>
                    ))}
                  </span>
                ) : null,
              },
            ]}
          />
          <p className="mt-4 text-xs text-pedra-500">Nome, usuário e permissões são alterados pela administração.</p>
        </Panel>
        <Panel title="Alterar senha">
          <ChangePasswordForm />
        </Panel>
      </div>
    </>
  );
}
