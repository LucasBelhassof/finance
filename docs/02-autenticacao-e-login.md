# 02. Autenticação e login

## Visão geral

A autenticação é baseada em dois artefatos distintos:

- access token JWT de curta duração enviado no header `Authorization: Bearer ...`
- refresh token opaco persistido em banco e guardado em cookie HttpOnly

Essa separação reduz exposição do token de renovação e permite revogação por sessão no servidor.

## Fluxo completo de login

### 1. Requisição

O cliente envia `POST /api/auth/login` com:

```json
{
  "email": "usuario@exemplo.com",
  "password": "senha",
  "rememberMe": false
}
```

Validação feita por `loginSchema` em `server/modules/auth/schemas.ts`.

### 2. Verificação

Em `server/modules/auth/service.ts`:

1. email é normalizado para lowercase
2. usuário é buscado por `findUserByEmail`
3. senha é verificada com `argon2.verify`
4. evento de auditoria é gravado em `auth_audit_events`

### 3. Sessão

Se a senha estiver correta:

1. um refresh token aleatório é gerado
2. apenas o hash SHA-256 do refresh token é salvo em `auth_sessions`
3. um `session_family_id` é criado para rastrear rotação
4. um JWT de acesso é emitido com TTL de 15 minutos

### 4. Resposta

O backend:

- escreve o refresh token em cookie HttpOnly
- devolve `user`, `accessToken` e `expiresAt`

## Geração e uso de JWT

### Emissão

O access token é gerado com `jose`:

- algoritmo `HS256`
- `sub` = `user.id`
- payload mínimo com `type`, `email` e `name`
- expiração baseada em `env.auth.accessTokenTtlMs`

### Uso

As rotas autenticadas usam:

1. `requireAccessToken` em `server/modules/auth/routes.ts`
2. parse do header `Authorization`
3. `verifyAccessToken`
4. carga de `request.auth = { userId, user }`

No app Express, o middleware global é aplicado assim:

```ts
app.use("/api", async (request, _response, next) => {
  await requireAccessToken(request);
  next();
});
```

Com isso, tudo que está sob `/api/*` é protegido, exceto o router de auth que é montado antes.

## Refresh token

### Estratégia

- token opaco aleatório
- persistência por hash em `auth_sessions`
- rotação a cada refresh
- detecção de reuse por `session_family_id`

### Fluxo de refresh

Endpoint: `POST /api/auth/refresh`

1. backend lê cookie `finance_rt` ou nome configurado
2. localiza sessão por hash do token
3. rejeita token inexistente
4. rejeita token expirado
5. rejeita token já rotacionado ou revogado
6. em caso de reuse, revoga toda a família de sessão
7. cria nova sessão e novo refresh token
8. marca sessão anterior como rotacionada
9. retorna novo `accessToken` e regrava cookie

## Por que usar rotação

Sem rotação, o mesmo refresh token poderia circular por muito tempo e dificultar a resposta a vazamento. Com rotação, o uso de um token antigo é tratado como sinal de comprometimento da sessão.

## Cookies e headers

### Cookie de refresh

Definido por `getRefreshCookieOptions`:

- `httpOnly: true`
- `sameSite: "lax"`
- `secure: env.isProduction`
- `path: "/api/auth"`
- `maxAge` só quando `rememberMe = true`

### Access token

- armazenado em memória no frontend dentro de `AuthProvider`
- nunca persistido em localStorage
- injetado automaticamente em `src/lib/api.ts`

## Logout

Endpoint: `POST /api/auth/logout`

Fluxo:

1. cookie de refresh é lido
2. sessão correspondente é revogada em `auth_sessions`
3. evento `logout_success` é auditado
4. resposta limpa o cookie com `expires: new Date(0)` e `maxAge: 0`
5. o frontend limpa estado de sessão e cache React Query

## Forgot password e reset

### Forgot password

Endpoint: `POST /api/auth/forgot-password`

Comportamento:

- sempre retorna mensagem neutra
- se o e-mail existir, invalida tokens ativos anteriores
- grava novo token em `password_reset_tokens`
- em ambiente não produtivo, expõe `debugResetUrl` na resposta

### Reset password

Endpoint: `POST /api/auth/reset-password`

Comportamento:

- token enviado pelo usuário é hasheado e comparado em banco
- token usado ou expirado é rejeitado
- senha é atualizada com Argon2
- tokens de reset ativos são invalidados
- todas as sessões do usuário são revogadas

## Frontend: bootstrap e refresh automático

O frontend usa `AuthProvider` em `src/modules/auth/components/AuthProvider.tsx`.

### Bootstrap de sessão

Ao iniciar a aplicação:

1. `AuthProvider` chama `refreshSession()`
2. se o cookie de refresh for válido, recebe novo `accessToken`
3. estado muda para `authenticated`
4. se falhar, o estado vira `anonymous`

### Refresh transparente

Em `src/lib/api.ts`, se uma requisição autenticada receber `401`:

1. a camada HTTP tenta `refreshAccessToken`
2. se renovar com sucesso, reexecuta a chamada original
3. se falhar, chama `onAuthFailure`
4. `onAuthFailure` limpa sessão, zera cache e redireciona para login

## Tabelas envolvidas

- `users`
- `auth_sessions`
- `password_reset_tokens`
- `auth_audit_events`

Detalhes de schema:

- adicionados em `013_auth_tables.sql`
- complementados por `014_signup_support.sql`
- onboarding e perfil vieram depois nas migrations `016`, `017` e `019`

## Segurança observada no código

- senhas com `argon2id`
- refresh token não é armazenado em claro no banco
- cookies HttpOnly
- CORS com `credentials: true`
- rate limit em login, signup, forgot, reset e refresh
- auditoria de sucesso/falha em eventos críticos
- revogação de sessões em troca de senha e reset
- proteção server-side por role admin em rotas administrativas

## Edge cases tratados

- credenciais inválidas no login
- refresh token ausente
- refresh token expirado
- refresh token reutilizado após rotação
- reset token usado
- reset token expirado
- mudança de email em `PATCH /api/auth/account` com limpeza de `email_verified_at`
- troca de senha igual à senha atual
- usuários antigos sem credenciais, tratados pelo bootstrap de auth

## Bootstrap de usuários legados

O projeto nasceu com usuários financeiros antes da autenticação completa. Por isso existe `bootstrapUserCredentials` no serviço de auth.

Objetivo:

- anexar e-mail e senha a usuários existentes sem recriar histórico financeiro
- escolher automaticamente o único usuário sem credenciais, se houver apenas um
- exigir seleção explícita quando houver múltiplos candidatos

Essa decisão preserva compatibilidade histórica do domínio financeiro.
