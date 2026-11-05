import { Lock } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/layout';

export default function SemPermissaoPage() {
  return (
    <div className="overflow-hidden rounded-2xl border border-pedra-200 bg-white shadow-[0_10px_30px_-22px_rgba(21,32,46,0.45)]">
      <EmptyState
        icon={<Lock className="h-8 w-8" />}
        title="Você não tem acesso a esta área"
        description="Se precisar dela para o seu serviço no acampamento, peça a permissão a um administrador."
        action={<ButtonLink href="/inicio" variant="secondary">Voltar ao início</ButtonLink>}
      />
    </div>
  );
}
