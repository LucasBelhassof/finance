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
