import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { APP_NAME } from '@/config/app';
import './globals.css';

// Atkinson Hyperlegible (licença SIL OFL), embutida no projeto.
const font = localFont({
  src: [
    { path: '../fonts/atkinson-hyperlegible-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/atkinson-hyperlegible-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const fetchCache = 'default-no-store';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Organização e administração de acampamentos.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1B2F4E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={font.variable}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 3500 }} />
      </body>
    </html>
  );
}
