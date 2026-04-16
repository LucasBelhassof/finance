# 05. Categorias e classificação

## Estrutura de categorias

A tabela `categories` possui dois níveis conceituais:

- categoria individual: por exemplo `Restaurantes`
- grupo de categoria: por exemplo `Alimentação`

Campos relevantes:

- `id`
- `slug`
- `label`
- `transaction_type`
- `icon`
- `color`
- `group_slug`
- `group_label`
- `group_color`
- `sort_order`
- `is_system`

## Por que existe grupo

O sistema usa `group_*` para agregação visual e analítica:

- gráfico de categorias no dashboard
- gráfico de categorias na tela de transações
- ranking de gastos por grupo
- leitura dos insights

## Tipos de categoria

Cada categoria tem `transaction_type`:

- `income`
- `expense`

Essa separação é importante porque:

- o backend valida compatibilidade com o sinal do valor
- o frontend filtra categorias disponíveis por tipo no formulário
- a importação usa o tipo para validar sugestões locais e por IA

## Categorias de sistema

A migration `012_category_system_flag.sql` introduz `is_system`.

Regras:

- categorias de sistema não podem ser excluídas
- servem como fallback estável para regras globais

Exemplos de fallback observados:

- `salario` para receitas
- `outros-despesas` para despesas

## Criação e update

### Criação

`createCategory`:

1. exige `label`, `transactionType`, `icon`, `color`, `groupLabel`, `groupColor`
2. gera `slug` com `slugify`
3. gera `groupSlug`
4. evita colisão de slug por contagem incremental
5. define `sort_order` baseado no maior valor existente

### Update

`updateCategory`:

- altera label, ícone, cor e metadados de grupo
- preserva o `slug`
- mantém `transaction_type`

## Exclusão e fallback

`deleteCategory` roda em transação e:

1. bloqueia remoção de categoria inexistente
2. bloqueia remoção de categoria `is_system`
3. resolve categoria fallback coerente com o tipo
4. migra referências em:
   - `transactions`
   - `housing`
   - `installment_purchases`
   - `transaction_categorization_rules`
5. remove a categoria

## Integração com transações

As transações dependem da categoria para:

- tipo semântico da movimentação
- agrupamento visual
- spending por grupo
- regras de IA e importação
- insights

## Lógica de classificação na importação

O sistema não depende apenas de IA externa. Ele tem uma hierarquia de classificação:

1. regra recorrente aprendida (`transaction_categorization_rules`)
2. histórico de categorização do usuário
3. regras locais por descrição
4. sugestão de IA, se habilitada
5. fallback conservador

## Regras recorrentes aprendidas

A tabela `transaction_categorization_rules` registra:

- `match_key`
- `type`
- `category_id`
- `times_confirmed`
- `source`

Quando o usuário confirma repetidamente a mesma decisão, a regra pode ser promovida para `learned_recurring`.
