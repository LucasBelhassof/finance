# 04. Transações e financeiro

## Papel da entidade

`transactions` é a tabela operacional central do domínio financeiro. Ela alimenta:

- dashboard
- lista de transações
- spending por categoria
- insights
- chat contextual
- importação
- parcelamentos
- habitação
- métricas administrativas

## Modelo de transação

Campos relevantes observados no código e migrations:

- `id`
- `user_id`
- `seed_key`
- `category_id`
- `bank_connection_id`
- `description`
- `amount`
- `occurred_on`
- `created_at`
- `installment_purchase_id`
- `installment_number`
- `housing_id`

## Entradas vs saídas

O sistema usa sinal numérico como regra canônica:

- `amount > 0`: receita
- `amount < 0`: despesa

Essa escolha simplifica:

- queries agregadas
- filtros por tipo
- cálculo de saldo líquido
- compatibilidade entre transação manual e transação importada

## Regra de categoria por tipo

Ao criar ou atualizar transação, `resolveCategoryForTransactionInput` aplica:

- receita exige categoria obrigatória
- despesa pode vir sem categoria, mas recebe fallback para `outros-despesas`
- categoria precisa combinar com o tipo inferido pelo sinal de `amount`

## Relacionamento com contas e cartões

Toda transação comum precisa de:

- `bankConnectionId`
- `categoryId` válido para o tipo
- `occurredOn`
- `description`
- `amount`

O backend valida se a conta/cartão pertence ao usuário antes de persistir.

## Parcelamentos

Parcelamentos não são um tipo separado de transação na UI. Eles são representados por:

- uma compra agregada em `installment_purchases`
- múltiplas linhas em `transactions`
- vínculo por `installment_purchase_id`
- índice da parcela em `installment_number`

### Por que modelar assim

- permite tratar cada parcela como lançamento real do mês
- mantém visão agregada para telas de parcelamento
- preserva granularidade de fluxo de caixa

## Regras importantes de atualização

### Edição de transação parcelada

Regra implementada recentemente:

- se o usuário trocar a categoria de uma parcela
- e a transação tiver `installment_purchase_id`
- e a categoria realmente mudar

então o backend atualiza:

- todas as outras transações do mesmo parcelamento
- a `category_id` da `installment_purchases`

Descrição, conta, data e valor continuam sendo alterados apenas na transação editada.

### Deleção

`DELETE /api/transactions/:id` remove apenas a linha informada. O código atual não implementa exclusão em cascata do parcelamento a partir dessa rota.

## Criação manual

`createTransaction`:

1. valida campos obrigatórios
2. resolve categoria compatível
3. valida conta/cartão do usuário
4. insere a linha em `transactions`
5. recarrega a transação com joins de categoria e conta

## Atualização manual

`updateTransaction`:

1. valida payload
2. carrega transação atual
3. resolve categoria/conta
4. propaga categoria em parcelamento quando necessário
5. atualiza a linha
6. retorna payload enriquecido

## Importação

Transações importadas podem gerar:

- uma única transação
- várias transações se a compra já vier identificada como parcelada

Nesse fluxo, `seed_key` é usado para deduplicação e reconciliação.

## Endpoints relacionados

- `GET /api/transactions`
- `POST /api/transactions`
- `PATCH /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `POST /api/transactions/import/preview`
- `POST /api/transactions/import/commit`
- `POST /api/transactions/import/ai-suggestions`

## Campos retornados ao frontend

`mapTransactionRow` enriquece a resposta com:

- `formattedAmount`
- `relativeDate`
- `isInstallment`
- `installmentPurchaseId`
- `installmentNumber`
- `installmentCount`
- `purchaseOccurredOn`
- `category`
- `account`

## Regras de negócio principais

- despesas usam valor negativo
- receitas usam valor positivo
- categoria deve respeitar o tipo da transação
- conta/cartão deve pertencer ao usuário
- despesas sem categoria usam fallback `outros-despesas`
- parcela pertence a um agrupador em `installment_purchases`
- alteração de categoria em parcela sincroniza o agrupador e as demais parcelas

## Consultas derivadas

As transações também alimentam:

- `getSummaryCards`
- `listSpendingByCategory`
- `listInsights`
- `getAdminFinancialMetrics`
- `getAdminUsers`

Ou seja, qualquer mudança nesse modelo impacta várias leituras agregadas.
