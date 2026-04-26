# 13. Arquitetura do frontend

## Visão geral

O frontend é uma SPA React com React Router e React Query. A arquitetura privilegia:

- roteamento centralizado
- fetch remoto por hooks
- mapeamento forte de payloads
- autenticação isolada em módulo próprio

## Estrutura

### `src/App.tsx`

Responsável por:

- `QueryClientProvider`
- `TooltipProvider`
- `Toaster`
- `BrowserRouter`
- `AuthProvider`
- definição das rotas

## Rotas

As rotas nomeadas ficam em `src/lib/routes.ts`. `App.tsx` monta:

- rotas públicas de auth
- rotas protegidas
- rotas admin

Rotas protegidas relevantes hoje:

- dashboard
- transações
- receitas recorrentes
- parcelamentos
- habitação
- métricas
- chat
- planejamentos e detalhe do planejamento
- caixinhas / savings goal
- notificações
- perfil
- configurações
- onboarding

## Autenticação no frontend

### `AuthProvider`

Funções centrais:

- armazena `accessToken` em memória
- faz bootstrap via refresh ao carregar a app
- injeta callbacks em `configureApiAuth`
- faz logout local e limpeza de cache

### Guards

- `ProtectedRoute`
- `PublicOnlyRoute`
- `AdminRoute`

## Módulos dedicados do frontend

### `src/modules/auth`

Além do login/logout, concentra:

- bootstrap de sessão
- guards de rota
- atualização de conta, contato e senha
- tipagem de onboarding/progresso do usuário

### `src/modules/product-tour`

Responsável por:

- definir os passos guiados por rota
- medir elementos com `data-tour-id`
- persistir progresso de onboarding no backend via auth
- reabrir, fechar, retomar e reiniciar o tour

Esse módulo fica no topo da árvore por meio de `ProductTourProvider` em `App.tsx`.

## Camada HTTP

`src/lib/api.ts` concentra:

- construção de URL
- `fetch` com `credentials: "include"`
- injeção do header Bearer
- retry automático após refresh
- normalização de payloads em tipos do frontend

## Tipagem

`src/types/api.ts` contém:

- tipos de payload bruto da API (`Api*`)
- tipos normalizados usados pela UI

## Hooks com React Query

Padrão observado:

- `queryKey`
- `useQuery` para leitura
- `useMutation` para escrita
- invalidação seletiva de caches relacionados

Exemplos:

- `useDashboard`
- `useTransactions`
- `useCategories`
- `useBanks`
- `useHousing`
- `useInsights`
- `useNotifications`
- `usePlans`
- `useInvestments`
- `useHealth`
- `useChat`

## Fluxo de dados

Padrão dominante:

1. página chama hook
2. hook chama função de `lib/api.ts`
3. `lib/api.ts` faz request, trata auth e normaliza resposta
4. página distribui dados em componentes visuais

## Estado local vs remoto

### Remoto

Quase todo estado persistente vem do servidor via React Query.

### Local

Usado para:

- filtros
- dialogs
- formulários
- seleção temporária de itens
- preferências locais em `Profile` e `Settings`
- estado de avanço visual do product tour

## Superfícies novas ou ampliadas

### Planejamentos

As páginas `Plans.tsx` e `PlanDetail.tsx` formam um fluxo próprio com:

- criação manual de plano
- geração de rascunho por IA a partir de chat
- revisão do draft antes de persistir
- vínculo entre chats, itens e meta financeira
- recomendações e avaliação assistida por IA

### Caixinhas / investimentos

`Investments.tsx` usa hooks próprios e também conversa com planejamentos:

- cada caixinha pode ter aporte fixo ou percentual
- pode ser criada isoladamente ou vinculada a um planejamento manual
- mutações invalidam dashboard e plans para manter consistência

### Perfil, configurações e onboarding

As páginas `Profile.tsx`, `Settings.tsx` e `Onboarding.tsx` ampliam a área de conta:

- `Profile` mostra identidade, plano, progresso de onboarding e atalhos de tour
- `Settings` concentra edição de conta, contato, senha, preferências locais e health check
- `Onboarding` atua como gatilho para reiniciar o product tour e redirecionar ao dashboard
