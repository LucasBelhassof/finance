# 03. Usuários e permissões

## Modelo de usuário

O usuário é a entidade raiz do sistema. Quase todos os recursos financeiros são particionados por `user_id`.

### Campos relevantes em `users`

Campos originalmente presentes:

- `id`
- `name`
- `created_at`

Campos adicionados depois pela camada de auth e perfil:

- `email`
- `password_hash`
- `updated_at`
- `email_verified_at`
- `role`
- `status`
- `is_premium`
- `premium_since`
- `onboarding_completed_at`
- `onboarding_progress`
- `phone`
- `address_*`

## Roles

### `user`

Role padrão. Pode acessar apenas seus próprios recursos:

- dashboard
- transações
- categorias
- contas
- parcelamentos
- habitação
- insights
- notificações próprias
- chat

### `admin`

Role administrativa. Pode acessar endpoints de observabilidade e gestão em `/api/admin/*`.

## Controle de acesso

### Backend

Todo endpoint sob `/api/*`, com exceção do router de auth, passa por `requireAccessToken`.

Resultado:

- o token é validado
- `request.auth.userId` fica disponível
- `request.auth.user` carrega os dados do usuário autenticado

### Acesso administrativo

Em `server/modules/admin/routes.ts`, todas as rotas usam `requireAdminAccess`.

Regras:

- `request.auth.user.role` deve ser `admin`
- acessos negados são auditados em `auth_audit_events` com evento `admin_access_denied`
- acessos permitidos também são auditados por evento específico

## Frontend

### Guards

Em `src/App.tsx`, o frontend usa três guards:

- `ProtectedRoute`
- `PublicOnlyRoute`
- `AdminRoute`

O frontend melhora UX, mas a segurança real continua no backend.

## Status do usuário

O campo `status` suporta:

- `active`
- `inactive`
- `suspended`

No código atual:

- o status é retornado e exibido
- consultas admin usam filtros por status
- notificações admin selecionam apenas usuários `active`

Não há, no trecho atual, um middleware global bloqueando explicitamente todos os usuários não ativos nas rotas comuns. Essa decisão precisa ser considerada ao evoluir o módulo.

## Premium

O modelo inclui:

- `is_premium`
- `premium_since`

Uso observado:

- métricas administrativas
- filtragem de audiência de notificações admin
- exibição no frontend de perfil/admin

Não existe no código atual uma diferenciação funcional ampla por premium dentro do domínio financeiro principal.

## Endpoints relacionados a usuário

### Auth / perfil

- `GET /api/auth/me`
- `PATCH /api/auth/onboarding`
- `PATCH /api/auth/account`
- `PATCH /api/auth/contact`
- `POST /api/auth/change-password`

### Admin

- `GET /api/admin/users`
- `GET /api/admin/overview`
- `GET /api/admin/financial-metrics`
- `GET /api/admin/subscription-metrics`
- `GET /api/admin/activity`

## Por que o scoping por usuário é central

O sistema manipula dados financeiros sensíveis. Por isso o padrão dominante nas queries de `server/database.js` é:

- receber `userId`
- normalizar com `requireUserId`
- filtrar por `WHERE user_id = $1`

Esse padrão evita dependência de filtros no frontend e reduz o risco de vazamento horizontal entre usuários.

## Casos especiais

### Notificações admin

O admin pode criar notificações para:

- todos os usuários ativos
- apenas premium
- apenas não premium
- usuários selecionados

Mas a leitura das notificações continua isolada por `notification_recipients.user_id`.

### Bootstrap de credenciais

Há compatibilidade explícita com usuários antigos sem e-mail/senha. O objetivo é preservar o histórico financeiro e anexar autenticação depois.
