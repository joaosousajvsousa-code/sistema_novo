import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde oliva militar (cor principal) e cáqui (destaque), a partir da logo.
        manto: { DEFAULT: '#3D4A2A', 600: '#4A5934', 700: '#313C22', 800: '#252E1A', 50: '#EFF2E8', 100: '#DDE3CF' },
        cirio: { DEFAULT: '#C8A165', 50: '#F8F0E3', 700: '#80612F' },
        pedra: { DEFAULT: '#F4F6F9', 100: '#E9EDF2', 200: '#DDE2E9', 300: '#C7CFDA', 400: '#98A3B3', 500: '#6B7789', 600: '#4E596A', 700: '#36404F', 900: '#15202E' },
        ok: { DEFAULT: '#2E7D5B', 50: '#E9F5EF' },
        aviso: { DEFAULT: '#9A6412', 50: '#FDF3E2' },
        erro: { DEFAULT: '#B3261E', 50: '#FCECEA' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { md: '8px', lg: '12px' },
      fontSize: {
        xs: ['0.8125rem', '1.15rem'],
        sm: ['0.9375rem', '1.35rem'],
        base: ['1rem', '1.5rem'],
        lg: ['1.1875rem', '1.6rem'],
        xl: ['1.5rem', '1.9rem'],
        '2xl': ['1.875rem', '2.25rem'],
      },
    },
  },
  plugins: [],
};
export default config;
