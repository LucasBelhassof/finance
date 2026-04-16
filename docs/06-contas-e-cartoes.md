# 06. Contas e cartões

## Modelo

O sistema representa contas e cartões na tabela `bank_connections`.

Campos relevantes:

- `id`
- `user_id`
- `slug`
- `name`
- `account_type`
- `connected`
- `color`
- `current_balance`
- `credit_limit`
- `parent_bank_connection_id`
- `statement_close_day`
- `statement_due_day`
- `sort_order`

## Tipos suportados

- `bank_account`
- `credit_card`
- `cash`

## Por que contas e cartões compartilham a mesma tabela

Esse desenho simplifica:

- relação com transações por `bank_connection_id`
- ordenação e exibição unificada de origens financeiras
- vínculo explícito entre conta bancária e cartão pai

## Cartão de crédito

É uma `bank_connection` com:

- `account_type = 'credit_card'`
- `credit_limit` obrigatório
- `parent_bank_connection_id` obrigatório
- `statement_close_day` obrigatório
- `statement_due_day` obrigatório

Regras validadas no backend:

- o pai deve existir
- o pai deve ser `bank_account`
- o cartão não pode apontar para si mesmo

## Caixa

Representa dinheiro em espécie.

Regra importante:

- o sistema exige que ao menos uma conta do tipo `cash` permaneça

## Limite de crédito

`credit_limit` só é aceito para cartões.

## Fechamento e vencimento

Os campos `statement_close_day` e `statement_due_day` são usados principalmente:

- na validação do cartão
- no cálculo do overview de parcelamentos
- na derivação de `next_due_date` por parcela

## Cálculo de saldo

`current_balance` é mantido no cadastro da conta e usado em:

- `getSummaryCards`
- `listBanks`
- `listInsights`
- métricas administrativas agregadas

O dashboard soma o `current_balance` de todas as contas do usuário. O código atual não recalcula esse saldo a partir das transações; ele trata o valor como dado de estado da conta.

## Regras de atualização e exclusão

### Update

`updateBankConnection`:

- valida regras por tipo
- impede transformar em algo diferente de `bank_account` quando existirem cartões filhos

### Delete

`deleteBankConnection` bloqueia exclusão quando:

- há cartões filhos
- a conta já foi usada em transações
- é a última conta `cash`

## Endpoints

- `GET /api/banks`
- `POST /api/banks`
- `PATCH /api/banks/:id`
- `DELETE /api/banks/:id`
