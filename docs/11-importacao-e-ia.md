# 11. Importacao e IA

## Visao geral

O importador trabalha em tres etapas:

1. preview
2. sugestao de IA opcional
3. commit

O rebuild universal preserva o fluxo antigo de preview/commit, mas agora aceita multiplos formatos e nao exige escolha previa de `importSource` antes do upload.

## Endpoints

- `POST /api/transactions/import/universal-preview`
- `POST /api/transactions/import/preview`
- `POST /api/transactions/import/ai-suggestions`
- `POST /api/transactions/import/commit`

## Formatos suportados

- CSV / TSV
- PDF com texto selecionavel
- XLSX / XLS
- OFX
- QIF
- JSON
- TXT estruturado

## Regras de preview

- a conta global passou a ser opcional
- quando uma conta e informada, ela precisa pertencer ao usuario autenticado
- o backend infere `bank_statement` ou `credit_card_statement` e devolve a confianca dessa inferencia
- o endpoint legado `/api/transactions/import/preview` continua funcionando e delega ao pipeline universal

## Sessao de preview

- o preview principal fica persistido temporariamente em Postgres com TTL de 15 minutos
- o fluxo universal adiciona metadados leves por token, como `detectedFileType`, `detectedSourceKind` e `selectedBankConnectionId`
- o arquivo bruto nao e persistido na sessao
- previews consumidos no commit sao marcados como utilizados e nao podem ser reutilizados

## Parsing

- CSV/TSV continuam usando normalizacao tabular com aliases de cabecalho
- XLSX/XLS, OFX, QIF, JSON e TXT sao normalizados para o mesmo contrato interno do preview
- PDFs continuam usando `pdf-parse`
- PDFs com texto selecionavel agora tentam, nesta ordem:
  1. parser conhecido de fatura/cartao
  2. fallback generico para extratos com datas agrupadas, palavras-chave bancarias e saldo por linha
  3. fallback generico antigo de linhas `data + descricao + valor`
- OCR continua fora de escopo; PDF sem texto selecionavel deve falhar com erro explicito
- o fallback generico de extrato suporta:
  - cabecalhos de data em portugues, inclusive `1 de Marco de 2026`
  - datas curtas como `10/05`, `10/05/2026` e `2026-05-10`
  - linhas com um valor monetario ou com `valor + saldo apos a transacao`
  - inferencia conservadora de debito/credito por sinal explicito e palavras-chave
- o parser continua sem persistir arquivo bruto ou texto bruto de PDF

## Parcelamentos e dedupe

- a deteccao de parcelamento e mantida
- o commit continua criando `installment_purchases` e `transactions` derivadas quando aplicavel
- a deduplicidade continua baseada em `buildImportSeedKey`, `buildInstallmentPurchaseSeedKey` e `buildInstallmentTransactionSeedKey`

## IA

- a IA continua rodando somente depois da extracao e do preview
- o backend envia apenas contexto normalizado das linhas, nunca o arquivo bruto
- a IA continua restrita a sugerir tipo/categoria dentro da whitelist da aplicacao

## Commit

`commitTransactionImport` agora:

1. recupera a sessao de preview
2. valida o shape do payload
3. resolve conta global opcional e override por linha
4. respeita `sourceKind` por linha quando o usuario corrige extrato vs fatura
5. preserva dedupe, parcelamentos e aprendizagem de categoria

## Integracao com frontend

Hooks principais:

- `useUniversalImportPreview`
- `usePreviewTransactionImport` (wrapper legado)
- `useImportAiSuggestions`
- `useCommitTransactionImport`
