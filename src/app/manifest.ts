import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/config/app';

// Configuração do aplicativo instalável (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/inicio',
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Organização do acampamento: equipes, recrutas, tropas, cronograma e financeiro.',
    lang: 'pt-BR',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#252E1A',
    theme_color: '#3D4A2A',
    categories: ['productivity'],
    // Só a logo, sem fundo (sem ícone "maskable", que o Android preenche com cor).
    icons: [
      { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
