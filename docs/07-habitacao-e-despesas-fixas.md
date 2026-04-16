# 07. Habitação e despesas fixas

## Objetivo do módulo

O módulo `housing` modela despesas fixas e financiamentos relacionados à moradia e itens semelhantes, gerando automaticamente transações derivadas.

Tipos suportados:

- `rent`
- `home_financing`
- `electricity`
- `water`
- `condo`
- `vehicle_financing`
- `other`

## Modelo

Campos relevantes em `housing`:

- `id`
- `user_id`
- `bank_connection_id`
- `category_id`
- `description`
- `expense_type`
- `amount`
- `due_day`
- `start_date`
- `installment_count`
- `notes`
- `status`

## Relação com transações

O módulo não é apenas cadastro. Ele materializa lançamentos em `transactions`.

### Despesa recorrente simples

Para tipos não financeiros parcelados:

- gera uma transação única associada ao `housing_id`
- descrição igual ao texto do item
- valor negativo
- `occurred_on` calculado com `start_date` + `due_day`
- `seed_key` no padrão `housing:{id}:recurring`

### Financiamento

Para `home_financing` e `vehicle_financing`:

- cria uma linha em `installment_purchases`
- gera uma transação por parcela
- cada parcela recebe `installment_purchase_id`
- cada parcela recebe `installment_number`
- `seed_key` segue `housing:{id}:installment:{n}`

## Por que gerar transações automaticamente

Essa decisão mantém o domínio coerente:

- dashboard e relatórios leem transações
- não é necessário criar lógica paralela de agregação para housing
- parcelamentos de habitação entram no mesmo pipeline analítico dos demais parcelamentos

## Cálculo de vencimento

`addMonthsToDate`:

1. usa `start_date` como âncora
2. soma o deslocamento mensal
3. ajusta o dia final pelo `due_day`
4. faz clamp para o último dia válido do mês

## Validação

`validateHousingInput` exige:

- `description`
- `expenseType` válido
- `amount > 0`
- `dueDay` entre 1 e 31
- `startDate`
- `bankConnectionId`

Regras extras:

- `installmentCount >= 2` para tipos de financiamento
- `status` pode ser `active` ou `inactive`

## Criação

`createHousing`:

1. valida input
2. valida conta/cartão
3. resolve categoria como despesa
4. insere item em `housing`
5. chama `generateHousingTransactions`
6. retorna item enriquecido com transações geradas

## Atualização

`updateHousing`:

1. revalida todo o cadastro
2. atualiza a linha de `housing`
3. remove transações e parcelamentos anteriores associados
4. regenera tudo a partir do estado novo

## Status

Quando `status !== "active"`:

- o módulo apaga transações existentes ligadas ao `housing_id`
- não recria novas transações

## Exclusão

`deleteHousing` remove a linha em `housing`.

## Endpoints

- `GET /api/housing`
- `POST /api/housing`
- `PATCH /api/housing/:id`
- `DELETE /api/housing/:id`
