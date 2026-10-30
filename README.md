# HOLY CAMP — Gestão do acampamento

> Nomenclatura: **Recrutas** (encontristas), **Soldados/Servos** (servidores),
> **Equipes** (equipes de trabalho) e **Tropas** (grupos dos recrutas).

Sistema web para organizar acampamentos: equipes de serviço com links de
inscrição, servidores, encontristas, fichas com informações de saúde
protegidas e distribuição em grupos. Feito primeiro para o celular.

**Tecnologia:** Next.js 14 (TypeScript) · Tailwind CSS · Supabase (banco
PostgreSQL, login e regras de acesso) · hospedagem na Vercel.

---

## O que já funciona (Fase 1 — Fundação)

| Módulo | O que faz |
|---|---|
| Login | Entrada por **nome de usuário e senha**, sem cadastro público. Senha temporária obrigatoriamente trocada no 1º acesso. Recuperação pela administração. |
| Usuários e permissões | Perfis Administrador, Coordenador geral, Coordenador de equipe e Voluntário, com permissões extras por pessoa (ex.: ver saúde). Desativar usuário derruba o acesso na hora. |
| Configurações | O acampamento já vem criado. Dados, datas e local podem ser preenchidos depois; tamanhos de camiseta, perguntas extras da inscrição e aviso de privacidade. |
| Equipes de serviço | Limite de vagas, coordenadores, abrir/fechar inscrições, link público para WhatsApp e geração de novo link. |
| Inscrição pública | Formulário por equipe, com consentimento (LGPD). Bloqueia duplicidade e **nunca passa do limite**, mesmo com várias pessoas ao mesmo tempo. |
| Servidores | Lista com filtros, cadastro interno, edição, cancelamento/reativação, transferência de equipe e histórico. |
| Encontristas | Cadastro manual das fichas físicas, lista com busca e filtros, ficha com abas (dados, emergência, saúde, grupo, histórico). |
| Saúde | Alergias e medicamentos com a opção "não informado". Só quem tem permissão vê, e **cada consulta fica registrada**. |
| Grupos | Grupos com limite opcional, distribuição em lote e realocação sem duplicar a ficha. |
| Cronograma | Lista do cronograma por dia, colada de uma vez ou momento a momento. Um tique marca que o momento começou (o anterior é concluído). Mostra agora/próximo, atraso, previsão dos seguintes e permite empurrar horários guardando o original. Atualiza sozinho a cada 15 s. |
| Financeiro | Só com a permissão “Financeiro”. Pagamento na ficha de cada soldado/servo (valor combinado e pago, comprovante, conferência, isenção, estorno); receitas e despesas com categorias, equipe e comprovante; orçamento por categoria; saldo bancário informado x livro-caixa; exportação Excel. |
| Presença | Aba dentro de **Recrutas**. Tela para o celular: busca por nome ou telefone, tropa e camiseta de cada recruta, botões grandes de Presente/Ausente, contador ao vivo e por tropa. Sem dados de saúde. Permissão “Marcar presença”. |
| Camisetas | Total por tamanho para o fornecedor, quadro por equipe e por tropa, filtros, lista nominal, exportação Excel e “Fechar pedido” com versões guardadas. Permissão “Relatório de camisetas”. |
| Painel | Indicadores e alertas calculados dos dados reais (equipes lotadas, sem coordenador, encontristas sem grupo, camisetas sem tamanho). |
| Auditoria | Registro de todas as alterações importantes. Ninguém consegue editar ou apagar. |

**Próximas fases:** exportação de listas e tarefas.

---

## Como colocar no ar (passo a passo)

São três partes: banco de dados (Supabase), hospedagem (Vercel) e o
primeiro administrador. Leva uns 20 minutos.

### 1. Criar o banco no Supabase

1. Acesse [supabase.com](https://supabase.com) e clique em **New project**.
   Use um projeto **novo e só para o Acampa**. Escolha a região *South
   America (São Paulo)* e anote a senha do banco.
2. Quando o projeto terminar de ser criado, abra **SQL Editor** → **New query**.
3. Rode, **em ordem**, cada arquivo da pasta `supabase/migrations/`:
   copie todo o conteúdo, cole no SQL Editor e clique em **Run**. Deve
   aparecer *Success*. Se der erro, nada é salvo pela metade.
   - [`0001_fundacao.sql`](supabase/migrations/0001_fundacao.sql)
   - [`0002_tenentes.sql`](supabase/migrations/0002_tenentes.sql) — tenentes das tropas
   - [`0003_cronograma.sql`](supabase/migrations/0003_cronograma.sql) — cronograma ao vivo
   - [`0004_financeiro.sql`](supabase/migrations/0004_financeiro.sql) — financeiro e comprovantes
   - [`0005_categorias_equipes.sql`](supabase/migrations/0005_categorias_equipes.sql) — equipes viram categorias de despesa
   - [`0006_presenca_camisetas.sql`](supabase/migrations/0006_presenca_camisetas.sql) — presença dos recrutas e relatório de camisetas
4. Vá em **Authentication** → **Sign In / Providers**:
   - Deixe o provedor **Email** ativado.
   - **Desative** a opção *Allow new users to sign up*. As contas são
     criadas só pela administração, dentro do sistema.
   - Em *Password requirements*, coloque tamanho mínimo **8**.
5. Vá em **Project Settings** → **API** e copie:
   - **Project URL**
   - **anon public** key
   - **service_role** key (é secreta, não compartilhe)

### 2. Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com), clique em **Add New → Project** e
   escolha o repositório **sistema_novo**.
2. Antes de clicar em *Deploy*, abra **Environment Variables** e cadastre:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role |
   | `INITIAL_SETUP_CODE` | um código secreto que você inventar (mín. 8 caracteres) |

3. Clique em **Deploy** e aguarde o endereço do site.

### 3. Criar o primeiro administrador

1. Abra `https://SEU-SITE.vercel.app/primeiro-acesso`.
2. Informe o código que você colocou em `INITIAL_SETUP_CODE`, seu nome, um
   nome de usuário e a senha.
3. Pronto: entre pela tela de login. A tela de primeiro acesso se bloqueia
   sozinha depois que existe um usuário. Se quiser, apague a variável
   `INITIAL_SETUP_CODE` da Vercel.

### 4. Primeiros passos no sistema

1. **Configurações:** o acampamento já vem criado, com as inscrições
   abertas. Preencha nome, datas e local quando estiverem definidos.
2. **Usuários:** crie as contas da coordenação. O sistema gera a senha
   temporária para você repassar.
3. **Equipes:** crie cada equipe com o limite de vagas, defina os
   coordenadores e envie o link de inscrição pelo WhatsApp.
4. **Encontristas:** cadastre as fichas físicas. Depois crie os **Grupos**
   e use **Distribuir encontristas**.

---

## Segurança e privacidade

- Todas as regras de acesso ficam **no banco** (RLS do PostgreSQL), não só
  na tela. Mesmo alguém com a chave pública não consegue ler o que não pode.
- O limite de vagas é garantido no banco com trava de linha: duas
  inscrições simultâneas nunca ocupam a mesma última vaga.
- Dados de saúde ficam numa tabela sem leitura direta; só saem por uma
  função que confere a permissão e registra quem consultou.
- A auditoria grava quem fez o quê e quando. Alterações de saúde registram
  quais campos mudaram, sem copiar os valores.
- A chave `service_role` é usada só no servidor, e só depois de conferir a
  permissão de quem pediu a ação.
- Senhas nunca são gravadas pelo sistema (ficam com o Supabase Auth).
- Não use dados reais de participantes em ambientes de demonstração.

**Como o login por usuário funciona:** o Supabase Auth exige um e-mail, então
cada usuário vira internamente `usuario@usuarios.acampa.app`. Nenhum e-mail é
enviado. Por isso a recuperação de senha é feita pela administração, que gera
uma senha temporária.

---

## Para desenvolvedores

```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase
npm run dev                  # http://localhost:3000
npm run typecheck
npm run build
```

Estrutura principal:

```
supabase/migrations/   SQL do banco (tabelas, RLS, funções e auditoria)
src/app/(app)/         telas internas (exigem login)
src/app/inscricao/     formulário público por equipe
src/lib/               acesso ao Supabase, permissões, validação, formatação
src/components/        componentes de interface
```

- O nome do sistema muda em `src/config/app.ts` ou pela variável
  `NEXT_PUBLIC_APP_NAME`.
- Novas migrações devem revogar os privilégios padrão do Supabase
  (`anon`/`authenticated`) e conceder só o necessário, como faz a `0001`.

A fonte Atkinson Hyperlegible é distribuída sob a licença SIL Open Font
License (veja `src/fonts/LICENSE-OFL.txt`).
