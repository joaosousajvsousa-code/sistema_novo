import type { Metadata } from 'next';
import { CalendarDays, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { Logo } from '@/components/Logo';
import { Notice } from '@/components/ui/layout';
import { formatDateRange } from '@/lib/format';
import { PublicForm } from './PublicForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Inscrição de soldados/servos' };

type Info = {
  team_name: string;
  team_description: string | null;
  camp_name: string;
  camp_start: string | null;
  camp_end: string | null;
  camp_location: string | null;
  open: boolean;
  available: number;
  shirt_sizes: string[];
  signup_fields: { key: string; label: string; type: 'text' | 'select'; required: boolean; options: string[] }[];
  privacy_notice: string | null;
};

const FALLBACK_PRIVACY =
  'Seus dados serão usados apenas pela coordenação do acampamento para organizar as equipes, entrar em contato e produzir as camisetas.';

export default async function InscricaoPage({ params }: { params: { slug: string } }) {
  let info: Info | null = null;
  let failed = false;
  if (supabaseConfigured() && /^[a-z0-9-]{6,80}$/.test(params.slug)) {
    const { data, error } = await createClient().rpc('public_team_info', { p_slug: params.slug });
    failed = Boolean(error);
    info = (data as Info | null) ?? null;
  }

  return (
    <div className="min-h-dvh bg-pedra">
      <header className="bg-manto px-4 pb-14 pt-5 text-white">
        <div className="mx-auto max-w-lg">
          <Logo light />
          {info ? (
            <div className="mt-6">
              <p className="text-sm text-manto-100/80">{info.camp_name}</p>
              <h1 className="mt-1 text-2xl font-bold text-white">Equipe {info.team_name}</h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-manto-100/80">
                {info.camp_start || info.camp_end ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" aria-hidden /> {formatDateRange(info.camp_start, info.camp_end)}
                  </span>
                ) : null}
                {info.camp_location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden /> {info.camp_location}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto -mt-8 max-w-lg px-4 pb-12">
        <div className="rounded-lg border border-pedra-200 bg-white p-5 sm:p-6">
          {failed ? (
            <Notice tone="erro" title="Não foi possível carregar o formulário">
              Verifique a internet e recarregue a página.
            </Notice>
          ) : !info ? (
            <div className="py-4 text-center">
              <h1 className="text-xl">Link não encontrado</h1>
              <p className="mt-2 text-sm text-pedra-600">Este link de inscrição não existe ou foi desativado. Peça um link atualizado à coordenação da equipe.</p>
            </div>
          ) : !info.open ? (
            <div className="py-4 text-center">
              <h2 className="text-xl">Inscrições fechadas</h2>
              <p className="mt-2 text-sm text-pedra-600">As inscrições para esta equipe não estão abertas no momento.</p>
            </div>
          ) : info.available <= 0 ? (
            <div className="py-4 text-center">
              <h2 className="text-xl">Vagas esgotadas</h2>
              <p className="mt-2 text-sm text-pedra-600">Todas as vagas da equipe {info.team_name} já foram preenchidas.</p>
            </div>
          ) : (
            <>
              {info.team_description ? <p className="mb-5 whitespace-pre-line text-sm text-pedra-700">{info.team_description}</p> : null}
              <p className="mb-5 text-sm text-pedra-500">
                {info.available} vaga{info.available === 1 ? '' : 's'} disponíve{info.available === 1 ? 'l' : 'is'}. Campos com * são obrigatórios.
              </p>
              <PublicForm
                slug={params.slug}
                teamName={info.team_name}
                sizes={info.shirt_sizes}
                fields={info.signup_fields}
                privacyNotice={info.privacy_notice || FALLBACK_PRIVACY}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
