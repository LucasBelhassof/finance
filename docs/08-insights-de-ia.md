# 08. Insights de IA

## Visão geral

Apesar do nome da tela, os insights atuais não dependem de LLM externa. O sistema usa um motor determinístico em `server/insights-engine.js` para produzir leituras curtas a partir dos dados financeiros reais do usuário.

## Objetivo

Substituir mensagens estáticas por insights:

- explicáveis
- repetíveis
- baratos de executar
- baseados em gastos reais

## Pipeline

`GET /api/insights` chama `listInsights` em `server/database.js`, que:

1. soma `current_balance` das contas
2. busca até 500 despesas reais do usuário com categoria/grupo
3. normaliza o payload
4. passa os dados para `generateInsights`

## Snapshot mensal

A base das regras é `buildMonthlySpendingSnapshot`, que deriva:

- mês de referência
- despesas do mês atual
- despesas do mês anterior
- gastos dos últimos 14 dias
- saldo total atual
- categorias do mês com share
- parcelas do mês
- recorrências
- candidato a outlier

## Regras implementadas

- `top_category`
- `spending_spike`
- `recurring_charges`
- `unusual_expense`
- `category_concentration`
- `low_balance_risk`
- `installment_pressure`

## Priorização

O motor usa:

- prioridade semântica (`high`, `medium`, `low`)
- peso por tipo de insight
- deduplicação semântica
- limite padrão de 4 itens

## Estrutura do payload

Cada insight retorna:

- `id`
- `title`
- `description`
- `tag`
- `tone`
- `priority`
- `insightType`
- `metadata`
- `action`

Exemplo compatível com o código:

```json
{
  "id": "installments-2026-04",
  "title": "Parcelamentos estao pesando no mes",
  "description": "As parcelas comprometem R$ 640,00 neste periodo (32% das despesas). Vale rever novas compras parceladas ate esse peso diminuir.",
  "tag": "Parcelas",
  "tone": "warning",
  "priority": "high",
  "insightType": "installment_pressure",
  "metadata": {
    "referenceMonth": "2026-04",
    "installmentTotal": 640,
    "installmentShare": 0.32
  },
  "action": {
    "kind": "review_installments",
    "label": "Ver parcelamentos"
  }
}
```

## Frontend

O frontend:

- consome `GET /api/insights` via `useInsights`
- normaliza ícones e cores em `src/lib/api.ts`
- exibe badges de prioridade e tone em `AiInsights`
- mapeia CTAs para rotas reais da aplicação

## Testes existentes

`server/insights-engine.test.js` cobre:

- sem transações
- aumento relevante de gastos
- categoria dominante
- recorrências
- peso de parcelamentos
- ordenação por prioridade
- ausência de duplicidade semântica
