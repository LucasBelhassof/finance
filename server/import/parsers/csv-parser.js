import { decodeTextBuffer, detectDelimiter, normalizeAmountInput, normalizeDateInput, normalizeHeaderKey, splitDelimitedLine } from "./tabular-utils.js";

const HEADER_ALIASES = {
  date: ["data", "date", "dt lancamento", "dt", "ocorrido em"],
  description: ["descricao", "description", "historico", "detalhes", "titulo", "title", "memo", "narrative"],
  amount: ["valor", "amount", "valor r$", "valor rs"],
  debit: ["debito", "saida", "withdrawal"],
  credit: ["credito", "entrada", "deposit"],
  type: ["tipo", "type"],
};

function resolveColumnIndexes(headers) {
  const normalizedHeaders = headers.map(normalizeHeaderKey);
  const findIndex = (aliases) => normalizedHeaders.findIndex((header) => aliases.includes(header));

  return {
    date: findIndex(HEADER_ALIASES.date),
    description: findIndex(HEADER_ALIASES.description),
    amount: findIndex(HEADER_ALIASES.amount),
    debit: findIndex(HEADER_ALIASES.debit),
    credit: findIndex(HEADER_ALIASES.credit),
    type: findIndex(HEADER_ALIASES.type),
  };
}

function resolveSignedAmount(cells, indexes) {
  if (indexes.amount >= 0) {
    return normalizeAmountInput(cells[indexes.amount]);
  }

  const debit = indexes.debit >= 0 ? normalizeAmountInput(cells[indexes.debit]) : null;
  const credit = indexes.credit >= 0 ? normalizeAmountInput(cells[indexes.credit]) : null;

  if (credit !== null && credit !== 0) {
    return Math.abs(credit);
  }

  if (debit !== null && debit !== 0) {
    return -Math.abs(debit);
  }

  return null;
}

export function parseCsvLikeBuffer(fileBuffer) {
  const text = decodeTextBuffer(fileBuffer);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const delimiter = detectDelimiter(lines);
  const headers = splitDelimitedLine(lines[0], delimiter);
  const indexes = resolveColumnIndexes(headers);
  const hasHeader = indexes.date >= 0 || indexes.description >= 0 || indexes.amount >= 0 || indexes.debit >= 0 || indexes.credit >= 0;
  const rows = [];
  const startIndex = hasHeader ? 1 : 0;

  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitDelimitedLine(lines[lineIndex], delimiter);
    const fallbackDate = normalizeDateInput(cells[0]);
    const fallbackDescription = String(cells[1] ?? "").trim();
    const fallbackAmount = normalizeAmountInput(cells[2]);
    const occurredOn = indexes.date >= 0 ? normalizeDateInput(cells[indexes.date]) : fallbackDate;
    const description = indexes.description >= 0 ? String(cells[indexes.description] ?? "").trim() : fallbackDescription;
    let amount = resolveSignedAmount(cells, indexes);

    if (amount === null) {
      amount = fallbackAmount;
    }

    if (!occurredOn || !description || amount === null) {
      continue;
    }

    const explicitType = indexes.type >= 0 ? normalizeHeaderKey(cells[indexes.type]) : "";
    const signedAmount =
      explicitType === "despesa" || explicitType === "expense"
        ? -Math.abs(amount)
        : explicitType === "receita" || explicitType === "income"
          ? Math.abs(amount)
          : amount;

    rows.push({
      occurredOn,
      description,
      amount: signedAmount,
      sourceRow: Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, cells[index] ?? ""])),
    });
  }

  return rows;
}
