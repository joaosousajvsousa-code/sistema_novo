'use client';

import * as React from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

// Convite para instalar o app. Some quando já está instalado ou se a pessoa fechar.
export function InstallApp() {
  const [prompt, setPrompt] = React.useState<PromptEvent | null>(null);
  const [ios, setIos] = React.useState(false);
  const [show, setShow] = React.useState(false);
  const [help, setHelp] = React.useState(false);

  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('holy-install-dismissed') === '1';
    } catch {}
    if (isStandalone() || dismissed) return;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
    if (isIos) {
      setIos(true);
      setShow(true);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
      setShow(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem('holy-install-dismissed', '1');
    } catch {}
  }

  return (
    <section aria-label="Instalar o aplicativo" className="mt-5 rounded-[14px] border border-cirio/40 bg-cirio-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-manto text-white">
          <Download className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-pedra-900">Instale o HOLY CAMP no celular</p>
          <p className="mt-0.5 text-sm text-pedra-600">Fica com a logo na tela inicial e abre em tela cheia, como um aplicativo.</p>
          {ios && help ? (
            <ol className="mt-3 space-y-2 text-sm text-pedra-700">
              <li className="leading-relaxed">
                <span className="font-bold">1.</span> No Safari, toque em <Share className="inline h-4 w-4 text-manto" aria-label="Compartilhar" /> (Compartilhar).
              </li>
              <li className="leading-relaxed">
                <span className="font-bold">2.</span> Escolha <SquarePlus className="inline h-4 w-4 text-manto" aria-hidden /> <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li className="leading-relaxed">
                <span className="font-bold">3.</span> Toque em <strong>Adicionar</strong>.
              </li>
            </ol>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {prompt ? (
              <button
                type="button"
                onClick={async () => {
                  await prompt.prompt();
                  const choice = await prompt.userChoice;
                  if (choice.outcome === 'accepted') setShow(false);
                  setPrompt(null);
                }}
                className="inline-flex h-11 items-center rounded-md bg-manto px-4 text-sm font-bold text-white hover:bg-manto-600"
              >
                Instalar o app
              </button>
            ) : ios && !help ? (
              <button type="button" onClick={() => setHelp(true)} className="inline-flex h-11 items-center rounded-md bg-manto px-4 text-sm font-bold text-white hover:bg-manto-600">
                Ver como instalar
              </button>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={dismiss} className="-m-1 rounded-md p-2 text-pedra-500 hover:bg-cirio/20" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
