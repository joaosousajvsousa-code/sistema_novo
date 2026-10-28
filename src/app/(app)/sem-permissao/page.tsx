import { Lock } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/layout';

export default function SemPermissaoPage() {
  return (
    <div className="rounded-lg border border-pedra-200 bg-white">
      <EmptyState
        icon={<Lock className="h-8 w-8" />}
        title="Você não tem acesso a esta área"
        description="Se precisar dela para o seu serviço no acampamento, peça a permissão a um administrador."
        action={<ButtonLink href="/painel" variant="secondary">Ir para o painel</ButtonLink>}
      />
    </div>
  );
}
