# 12. API endpoints

## Convenções gerais

- Base protegida: quase todo `/api/*` exige access token Bearer.
- Exceção: `/api/auth/*` e `/api/health`.
- Respostas de erro seguem `error`, `message` e opcionalmente `details`.

## Health

### `GET /api/health`

- Descrição: valida servidor e conexão com banco.
- Entrada: sem payload.

## Auth

### `POST /api/auth/login`

- Descrição: autentica usuário e inicia sessão.
- Entrada: `email`, `password`, `rememberMe`.
- Resposta: `user`, `accessToken`, `expiresAt`.
- Regras: grava refresh token em cookie HttpOnly; audita sucesso/falha.

### `POST /api/auth/signup`

- Descrição: cria usuário com sessão já autenticada.
- Entrada: `name`, `email`, `password`, `confirmPassword`, `rememberMe`.
- Regras: email único case-insensitive.

### `POST /api/auth/refresh`

- Descrição: rotaciona refresh token e devolve novo access token.
- Entrada: cookie HttpOnly.

### `POST /api/auth/logout`

- Descrição: revoga sessão atual.

### `POST /api/auth/forgot-password`

- Descrição: inicia recuperação de senha.

### `POST /api/auth/reset-password`

- Descrição: troca senha usando token de reset.

### `GET /api/auth/me`

- Descrição: retorna o usuário autenticado.

### `PATCH /api/auth/onboarding`

- Descrição: atualiza progresso do onboarding.

### `PATCH /api/auth/account`

- Descrição: atualiza nome e email.

### `PATCH /api/auth/contact`

- Descrição: atualiza telefone e endereço.

### `POST /api/auth/change-password`

- Descrição: troca senha do usuário autenticado.

## Dashboard

### `GET /api/dashboard`

- Descrição: resposta agregada para home.

## Investimentos / caixinhas

### `GET /api/investments`

- Descrição: lista as caixinhas do usuário.

### `POST /api/investments`

- Descrição: cria uma caixinha manual.
- Regras:
  - aceita modo de aporte fixo ou percentual da receita
  - pode opcionalmente nascer vinculada a um planejamento manual

### `PATCH /api/investments/:id`

- Descrição: atualiza uma caixinha existente.

### `DELETE /api/investments/:id`

- Descrição: remove a caixinha.
- Regras:
  - o frontend invalida dashboard e planejamentos relacionados

## Transações

### `GET /api/transactions`

- Descrição: lista transações do usuário.
- Query opcional: `limit`.

### `POST /api/transactions`

- Descrição: cria transação manual.
- Entrada: `description`, `amount`, `occurredOn`, `bankConnectionId`, `categoryId`.

### `PATCH /api/transactions/:id`

- Descrição: atualiza transação.
- Regras:
  - valida conta e categoria
  - se for parcela e a categoria mudar, sincroniza todas as parcelas da mesma compra

### `DELETE /api/transactions/:id`

- Descrição: remove a transação.

## Importação

### `POST /api/transactions/import/preview`

- Descrição: gera preview do arquivo importado.

### `POST /api/transactions/import/ai-suggestions`

- Descrição: aplica sugestão de IA ao preview.

### `POST /api/transactions/import/commit`

- Descrição: grava as linhas do preview no banco.

## Housing

### `GET /api/housing`

- Descrição: lista despesas fixas e financiamentos.

### `POST /api/housing`

- Descrição: cria item de housing.

### `PATCH /api/housing/:id`

- Descrição: atualiza item e regenera transações derivadas.

### `DELETE /api/housing/:id`

- Descrição: exclui item de housing.

## Parcelamentos

### `GET /api/installments/overview`

- Descrição: visão analítica de compras parceladas.

## Categorias

### `GET /api/categories`

- Descrição: lista categorias.

### `POST /api/categories`

- Descrição: cria categoria.

### `PATCH /api/categories/:id`

- Descrição: atualiza metadados da categoria.

### `DELETE /api/categories/:id`

- Descrição: exclui categoria não sistêmica e migra referências para fallback.

## Spending e insights

### `GET /api/spending`

- Descrição: gastos agregados por grupo de categoria no mês de referência.

### `GET /api/insights`

- Descrição: insights financeiros determinísticos do usuário.

## Bancos / contas

### `GET /api/banks`

- Descrição: lista contas, cartões e caixa.

### `POST /api/banks`

- Descrição: cria conta/cartão.

### `PATCH /api/banks/:id`

- Descrição: atualiza conta/cartão.

### `DELETE /api/banks/:id`

- Descrição: exclui conta/cartão respeitando restrições.

## Planejamentos

### `GET /api/plans`

- Descrição: lista planejamentos do usuário.

### `POST /api/plans`

- Descrição: cria planejamento manual ou derivado de IA.

### `POST /api/plans/ai/draft`

- Descrição: gera rascunho de planejamento a partir de um chat.
- Entrada: `chatId`.

### `POST /api/plans/ai/revise-draft`

- Descrição: revisa um rascunho existente usando instrução textual do usuário.
- Entrada: `chatId`, `draft`, `correction`.

### `POST /api/plans/ai/suggest-link`

- Descrição: sugere vínculo de um chat com um planejamento existente ou recomenda criar um novo.
- Entrada: `chatId`.

### `GET /api/plans/:planId`

- Descrição: retorna detalhes completos do planejamento, incluindo itens, progresso, chats vinculados e avaliação.

### `POST /api/plans/:planId/ai/evaluate`

- Descrição: pede uma avaliação manual da IA sobre o andamento do plano.

### `GET /api/plans/:planId/recommendations`

- Descrição: lista recomendações pendentes/anteriores para o plano.

### `POST /api/plans/:planId/recommendations/:id/apply`

- Descrição: aplica uma recomendação específica ao planejamento.

### `PATCH /api/plans/:planId`

- Descrição: atualiza resumo, meta e itens do plano.

### `DELETE /api/plans/:planId`

- Descrição: remove o planejamento.

### `POST /api/plans/:planId/chats/:chatId`

- Descrição: vincula um chat a um planejamento.

### `DELETE /api/plans/:planId/chats/:chatId`

- Descrição: remove o vínculo entre chat e planejamento.

## Chat

### `GET /api/chats`

- Descrição: lista conversas do usuário.

### `POST /api/chats`

- Descrição: cria uma nova conversa vazia.

### `GET /api/chats/search`

- Descrição: busca chats por título e conteúdo.
- Query: `q`, `limit`.

### `PATCH /api/chats/:chatId`

- Descrição: renomeia ou fixa/desfixa um chat.
- Entrada: `title` e/ou `pinned`.

### `GET /api/chats/:chatId/messages`

- Descrição: lista mensagens de uma conversa específica.
- Query opcional: `limit`.

### `GET /api/chats/:chatId/summary`

- Descrição: recupera resumo persistido do chat para uso em planejamento.

### `POST /api/chats/:chatId/summary`

- Descrição: gera e persiste resumo do chat.

### `POST /api/chats/:chatId/messages`

- Descrição: envia novas mensagens para uma conversa já existente e recebe a resposta da IA.

### `DELETE /api/chats/:chatId`

- Descrição: exclui a conversa e seu histórico.

### `GET /api/chat/messages`

- Descrição: lista mensagens recentes do usuário em formato agregado/legado.

### `POST /api/chat/messages`

- Descrição: cria um chat implícito e já grava a primeira mensagem com resposta contextual.

## Notificações

### `GET /api/notifications`

- Descrição: lista notificações do usuário.

### `POST /api/notifications/self`

- Descrição: cria notificação do próprio usuário.

### `PATCH /api/notifications/:recipientId/read`

- Descrição: marca notificação como lida.

### `PATCH /api/notifications/:recipientId/unread`

- Descrição: marca notificação como não lida.

### `PATCH /api/notifications/read-all`

- Descrição: marca todas como lidas.

### `DELETE /api/notifications/:recipientId`

- Descrição: remove recipient e apaga notificação base se ficar órfã.

## Admin

Todos exigem `role = admin`.

### `GET /api/admin/overview`

- Descrição: métricas gerais de usuários, sessões e volume.

### `GET /api/admin/users`

- Descrição: lista paginada de usuários com filtros.

### `GET /api/admin/financial-metrics`

- Descrição: métricas financeiras agregadas.

### `GET /api/admin/subscription-metrics`

- Descrição: métricas de premium/conversão.

### `GET /api/admin/activity`

- Descrição: timeline de auditoria/auth activity.

### `GET /api/admin/notification-targets`

- Descrição: lista usuários ativos elegíveis para notificação admin.

### `GET /api/admin/notifications`

- Descrição: lista notificações administrativas já criadas.

### `POST /api/admin/notifications`

- Descrição: cria notificação em massa para audiência definida.
