# 10. Dashboard

## Objetivo

O dashboard consolida o estado financeiro atual do usuário em uma única resposta. A composição acontece no backend por `getDashboardData`.

## Endpoint

- `GET /api/dashboard`

## Estrutura da resposta

- `user`
- `referenceMonth`
- `summaryCards`
- `recentTransactions`
- `spendingByCategory`
- `insights`
- `banks`
- `chatMessages`

## Como os dados são montados

`getDashboardData(userId)` executa em paralelo:

- `getSummaryCards`
- `listRecentTransactions`
- `listSpendingByCategory`
- `listInsights`
- `listBanks`
- `listChatMessages`
- `getReferenceMonth`

## Summary cards

`getSummaryCards` combina:

- soma de `current_balance` em `bank_connections`
- receitas e despesas do mês atual
- receitas e despesas do mês anterior

Depois `buildDashboardSummaryCards` monta:

- Saldo Total
- Receitas
- Despesas

## Spending

`listSpendingByCategory`:

1. encontra o `latest_month` em `monthly_summaries`
2. busca transações de despesa daquele mês
3. agrupa por grupo de categoria
4. calcula valor absoluto e percentual

## Insights

O dashboard consome o mesmo pipeline de `GET /api/insights`.

## Recent transactions

`listRecentTransactions`:

- traz últimas transações do usuário
- enriquece com conta, categoria e dados de parcelamento

## Contas

`listBanks` retorna contas bancárias, cartões e caixa.

## Chat

`listChatMessages` traz as últimas mensagens do chat financeiro.

## Frontend

O consumo é feito por:

- hook `useDashboard`
- página `src/pages/Index.tsx`
