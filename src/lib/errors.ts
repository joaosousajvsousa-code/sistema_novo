type DbError = { message?: string; code?: string; details?: string } | null | undefined;

const MESSAGES: Record<string, string> = {
  SEM_VAGAS: 'As vagas desta equipe estão esgotadas.',
  JA_INSCRITO: 'Já existe uma inscrição ativa com esses dados neste acampamento.',
  JA_CADASTRADO: 'Já existe um recruta com esse nome e data de nascimento (ou telefone e data) neste acampamento.',
  INSCRICOES_FECHADAS: 'As inscrições desta equipe estão fechadas.',
  EQUIPE_NAO_ENCONTRADA: 'Equipe não encontrada.',
  GRUPO_NAO_ENCONTRADO: 'Tropa não encontrada.',
  NAO_ENCONTRADO: 'Registro não encontrado.',
  SEM_PERMISSAO: 'Você não tem permissão para esta ação.',
  SEM_ACAMPAMENTO: 'Nenhum acampamento ativo. Cadastre o acampamento primeiro.',
  ACAMPAMENTO_FECHADO: 'O acampamento está encerrado ou arquivado. Os registros ficam apenas para consulta.',
  NOME_INVALIDO: 'Informe o nome completo (mínimo de 3 letras).',
  TELEFONE_INVALIDO: 'Telefone inválido. Use DDD + número, por exemplo (11) 98888-7777.',
  TELEFONE_EMERGENCIA_INVALIDO: 'Telefone do contato de emergência inválido.',
  DATA_NASCIMENTO_INVALIDA: 'Data de nascimento inválida.',
  TAMANHO_INVALIDO: 'Escolha um tamanho de camiseta da lista.',
  CONSENTIMENTO_OBRIGATORIO: 'É preciso concordar com o uso dos dados para concluir a inscrição.',
  GRUPO_CHEIO: 'A tropa não tem vagas suficientes para todos os selecionados.',
  LIMITE_MENOR_QUE_INSCRITOS: 'O limite não pode ficar abaixo da quantidade atual de integrantes.',
  ULTIMO_ADMIN: 'O sistema precisa de pelo menos um administrador ativo.',
  SELECAO_GRANDE: 'Selecione no máximo 500 pessoas por vez.',
  SEM_EQUIPE_TENENTE: 'Não há equipe de tenentes. Crie a equipe “Tenente” em Equipes ou escolha a equipe em Configurações.',
  TENENTE_INVALIDO: 'Só podem ser tenentes os soldados/servos ativos da equipe de tenentes.',
  TENENTE_EM_OUTRA_TROPA: 'Um dos tenentes escolhidos já lidera outra tropa.',
};

export function appErrorCode(err: DbError): string | null {
  const m = /ACAMPA:([A-Z_]+)/.exec(err?.message ?? '');
  return m ? m[1] : null;
}

export function friendlyError(err: DbError, fallback = 'Não foi possível salvar. Verifique a conexão e tente de novo.'): string {
  if (!err) return fallback;
  const code = appErrorCode(err);
  if (code) {
    if (code === 'CAMPO_OBRIGATORIO' && err.details) return `Preencha o campo “${err.details}”.`;
    if (code === 'CAMPO_INVALIDO' && err.details) return `Valor inválido no campo “${err.details}”.`;
    if (code === 'TENENTE_EM_OUTRA_TROPA' && err.details) return `Já lidera outra tropa: ${err.details}. Tire de lá antes de escolher aqui.`;
    if (code === 'GRUPO_CHEIO' && err.details) return `A tropa só tem ${err.details} vaga(s) livre(s) para os selecionados.`;
    if (code === 'LIMITE_MENOR_QUE_INSCRITOS' && err.details)
      return `O limite não pode ficar abaixo dos ${err.details} integrantes atuais.`;
    return MESSAGES[code] ?? 'Operação não permitida.';
  }
  switch (err.code) {
    case '23505':
      return 'Já existe um registro com esses dados.';
    case '23503':
      return 'Este registro está em uso e não pode ser removido.';
    case '23514':
    case '22P02':
    case '22007':
    case '22008':
      return 'Algum valor informado é inválido.';
    case '42501':
      return 'Você não tem permissão para esta ação.';
    default:
      return fallback;
  }
}
