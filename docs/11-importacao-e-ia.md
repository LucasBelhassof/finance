# 11. Importação e IA

## Visão geral

O fluxo de importação foi desenhado para reduzir erro manual sem comprometer segurança do dado. Ele é dividido em três etapas:

1. preview
2. sugestão de IA opcional
3. commit

## Endpoints

- `POST /api/transactions/import/preview`
- `POST /api/transactions/import/ai-suggestions`
- `POST /api/transactions/import/commit`

## Fontes suportadas

- `bank_statement`
- `credit_card_statement`

## Preview

### Validações iniciais

- conta precisa existir e pertencer ao usuário
- extrato de cartão exige `account_type = credit_card`
- extrato bancário exige `account_type = bank_account`

### Sessão de preview

O preview é mantido em memória por `previewSessions` com TTL de 15 minutos.

## Parsing

### CSV

O parser tenta:

- UTF-8
- fallback para Latin-1

Também normaliza aliases de cabeçalho para:

- data
- descrição
- valor
- débito
- crédito

### PDF

Há suporte a parsing de PDF por `pdf-parse`, incluindo detecção de emissor e referência temporal da fatura.

## Detecção de parcelamento

`extractInstallmentMetadata` reconhece padrões como:

- `Parcela 3/10`
- `10/12`

Quando detectado:

- o preview pode expandir parcelas futuras
- o commit cria `installment_purchases` e `transactions` derivadas

## Deduplicidade

O sistema usa fingerprints estáveis:

- `buildImportSeedKey`
- `buildInstallmentPurchaseSeedKey`
- `buildInstallmentTransactionSeedKey`

No commit:

- fingerprints já existentes são carregados do banco
- o lote atual mantém um conjunto local de fingerprints
- itens duplicados podem ser pulados automaticamente

## Classificação local

Antes da IA externa, o sistema tenta:

1. regras recorrentes aprendidas
2. histórico do usuário
3. regras locais por texto
4. sugestão de IA

## Sugestões de IA

O módulo `import-ai-service.js` suporta:

- modo `direct`
- modo `webhook`

No modo `direct`, o provider pode ser:

- OpenAI
- Gemini

## Contrato exigido da IA

A IA não devolve categoria livre. Ela devolve:

- `rowIndex`
- `suggestedType`
- `categoryKey`
- `confidence`
- `reason`
- `status`

E sempre precisa respeitar a whitelist enviada pela aplicação.

## Commit

`commitTransactionImport`:

1. recupera sessão de preview
2. valida shape do payload
3. carrega categorias e fingerprints atuais
4. importa linha por linha
5. aprende regra de categorização quando apropriado

## Resultado

O retorno informa:

- `importedCount`
- `skippedCount`
- `failedCount`
- `results[]` por linha

## Integração com frontend

Hooks:

- `usePreviewTransactionImport`
- `useImportAiSuggestions`
- `useCommitTransactionImport`

Após commit, o frontend invalida:

- transações
- dashboard
- spending
- insights
