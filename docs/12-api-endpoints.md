# 12. API Endpoints

## Transacoes

### `GET /api/transactions`

- Descricao: lista transacoes do usuario autenticado.

### `POST /api/transactions`

- Descricao: cria uma transacao manual.

### `PATCH /api/transactions/:id`

- Descricao: atualiza a transacao.

### `DELETE /api/transactions/:id`

- Descricao: remove a transacao.

## Importacao

### `POST /api/transactions/import/universal-preview`

- Descricao: gera preview universal com deteccao automatica de formato e de origem (`bank_statement` ou `credit_card_statement`).

### `POST /api/transactions/import/preview`

- Descricao: endpoint legado de preview; delega ao pipeline universal e preserva compatibilidade com o contrato antigo.

### `POST /api/transactions/import/ai-suggestions`

- Descricao: aplica sugestoes de IA sobre linhas do preview.

### `POST /api/transactions/import/commit`

- Descricao: grava as linhas do preview no banco, aceitando conta global opcional e override de conta/origem por linha.

## Housing

### `GET /api/housing`

- Descricao: lista despesas fixas e financiamentos.

### `POST /api/housing`

- Descricao: cria item de housing.

### `PATCH /api/housing/:id`

- Descricao: atualiza item e regenera transacoes derivadas.

### `DELETE /api/housing/:id`

- Descricao: exclui item de housing.

## Parcelamentos

### `GET /api/installments/overview`

- Descricao: visao analitica de compras parceladas.

## Categorias

### `GET /api/categories`

- Descricao: lista categorias.

### `POST /api/categories`

- Descricao: cria categoria.

### `PATCH /api/categories/:id`

- Descricao: atualiza metadados da categoria.

### `DELETE /api/categories/:id`

- Descricao: remove a categoria.
