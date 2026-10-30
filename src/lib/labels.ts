export const CAMP_STATUS: Record<string, { label: string; tone: 'neutral' | 'manto' | 'ok' | 'aviso' | 'cirio' }> = {
  planejamento: { label: 'Planejamento', tone: 'neutral' },
  inscricoes_abertas: { label: 'Inscrições abertas', tone: 'ok' },
  em_andamento: { label: 'Em andamento', tone: 'cirio' },
  encerrado: { label: 'Encerrado', tone: 'manto' },
  arquivado: { label: 'Arquivado', tone: 'neutral' },
};

export const TEAM_STATUS: Record<string, { label: string; tone: 'neutral' | 'ok' | 'aviso' }> = {
  aberta: { label: 'Inscrições abertas', tone: 'ok' },
  fechada: { label: 'Inscrições fechadas', tone: 'aviso' },
  inativa: { label: 'Inativa', tone: 'neutral' },
};

export const MEMBERSHIP_STATUS: Record<string, { label: string; tone: 'ok' | 'neutral' }> = {
  ativa: { label: 'Ativa', tone: 'ok' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: 'neutral' | 'manto' | 'ok' | 'aviso' | 'erro' }> = {
  pendente: { label: 'Pendente', tone: 'aviso' },
  comprovante_enviado: { label: 'Comprovante enviado', tone: 'manto' },
  em_analise: { label: 'Em análise', tone: 'manto' },
  confirmado: { label: 'Confirmado', tone: 'ok' },
  isento: { label: 'Isento', tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
  estornado: { label: 'Estornado', tone: 'erro' },
};

export const ENCONTRISTA_STATUS: Record<string, { label: string; tone: 'ok' | 'neutral' }> = {
  ativo: { label: 'Ativo', tone: 'ok' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

export const HEALTH_STATUS: Record<string, string> = {
  nao_informado: 'Não informado',
  nao_possui: 'Não possui',
  possui: 'Possui',
};

export const SOURCE_LABEL: Record<string, string> = {
  link_publico: 'Link de inscrição',
  cadastro_interno: 'Cadastro interno',
};

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  coord_geral: 'Coordenador geral',
  coord_equipe: 'Coordenador de equipe',
  voluntario: 'Voluntário',
};

export const PAYMENT_METHOD: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export const ATTENDANCE: Record<string, { label: string; tone: 'neutral' | 'ok' | 'erro' }> = {
  pendente: { label: 'Pendente', tone: 'neutral' },
  presente: { label: 'Presente', tone: 'ok' },
  ausente: { label: 'Ausente', tone: 'erro' },
};
