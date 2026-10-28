// Nome do sistema: troque aqui ou pela variável NEXT_PUBLIC_APP_NAME.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Acampa';

// O Supabase Auth exige um e-mail. As pessoas entram só com nome de usuário;
// por dentro ele vira <usuario>@<domínio interno>. Nenhum e-mail é enviado
// para esse endereço. Não altere depois de criar usuários.
export const AUTH_EMAIL_DOMAIN = 'usuarios.acampa.app';

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

export const TIME_ZONE = 'America/Sao_Paulo';
export const PAGE_SIZE = 25;
