import type { Metadata } from 'next';
import { CalendarDays, MapPin, Shield, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { LogoMark } from '@/components/Logo';
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

  const ready = info && info.open && info.available > 0;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-manto-800 px-4 pb-44 pt-8 sm:pb-56 sm:pt-12">
      {/* mesmo acabamento da tela de login: mapa de campanha, luz e pinheiros */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[url('/textura-topografica.svg')] bg-cover bg-center" />
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_15%,rgba(200,161,101,0.22),transparent_55%),radial-gradient(ellipse_at_50%_50%,transparent_40%,rgba(10,14,6,0.55))]"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[clamp(150px,18.75vw,300px)] bg-[url('/silhueta-acampamento.svg')] bg-cover bg-bottom" />

      <div className="mx-auto max-w-xl">
        <div className="flex flex-col items-center text-center">
          <LogoMark height={132} priority className="drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)]" />
          {info ? (
            <>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cirio-50 ring-1 ring-white/15">
                <Shield className="h-3.5 w-3.5 text-cirio" aria-hidden /> Alistamento · Soldados/Servos
              </span>
              <h1 className="mt-4 text-[2rem] font-bold leading-tight text-white sm:text-5xl">
                Equipe <span className="text-cirio">{info.team_name}</span>
              </h1>
              <p className="mt-2 text-base text-manto-100/85">{info.camp_name}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                {info.camp_start || info.camp_end ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-manto-100 ring-1 ring-white/10">
                    <CalendarDays className="h-4 w-4 text-cirio" aria-hidden /> {formatDateRange(info.camp_start, info.camp_end)}
                  </span>
                ) : null}
                {info.camp_location ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-manto-100 ring-1 ring-white/10">
                    <MapPin className="h-4 w-4 text-cirio" aria-hidden /> {info.camp_location}
                  </span>
                ) : null}
                {ready ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cirio px-3 py-1.5 font-bold text-manto-800">
                    <Users className="h-4 w-4" aria-hidden />
                    {info.available} vaga{info.available === 1 ? '' : 's'} restante{info.available === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(200,161,101,0.35)]">
          <div aria-hidden className="h-1.5 bg-[repeating-linear-gradient(135deg,#C8A165_0_10px,#3D4A2A_10px_20px)]" />
          <div className="p-5 sm:p-8">
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
                {info.team_description ? (
                  <p className="mb-6 whitespace-pre-line rounded-xl border-l-4 border-cirio bg-cirio-50 px-4 py-3 text-sm text-pedra-700">{info.team_description}</p>
                ) : null}
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
        </div>
        <p className="mt-6 text-center text-xs text-manto-100/60">Campos com * são obrigatórios. Seus dados ficam só com a coordenação.</p>
      </div>
    </main>
  );
}
