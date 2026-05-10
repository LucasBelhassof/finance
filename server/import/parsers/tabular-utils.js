import iconv from "iconv-lite";

const NOISE_TOKENS = [
  "saldo anterior",
  "saldo atual",
  "saldo do dia",
  "saldo final",
  "subtotal",
  "total",
  "totais",
  "resumo",
  "limite",
  "melhor dia",
  "pagamento minimo",
  "fatura anterior",
  "proxima fatura",
  "lancamentos futuros",
];

export const HEADER_ALIASES = {
  date: [
    "data",
    "date",
    "posted on",
    "postedon",
    "occurred on",
    "dt",
    "dt lancamento",
    "data movimento",
    "data lancamento",
  ],
  description: [
    "descricao",
    "description",
    "historico",
    "memo",
    "detalhes",
    "title",
    "titulo",
    "name",
    "payee",
    "lancamento",
  ],
  amount: ["valor", "amount", "signed amount", "signedamount", "value", "valor r$", "valor rs", "transaction amount"],
  debit: ["debito", "debit", "withdrawal", "saidas", "saida", "outflow"],
  credit: ["credito", "credit", "deposit", "entradas", "entrada", "inflow"],
  balance: ["saldo", "balance", "running balance", "balance after"],
  type: ["tipo", "type"],
  currency: ["moeda", "currency"],
  externalId: ["fitid", "id", "external id", "externalid", "transaction id"],
};

export const TABULAR_MAPPING_FIELDS = [
  "date",
  "description",
  "amount",
  "debit",
  "credit",
  "balance",
  "currency",
  "externalId",
];
export const TABULAR_REQUIRED_FIELDS = ["date", "description"];

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

export function decodeTextBuffer(buffer) {
  const utf8 = stripBom(buffer.toString("utf8"));

  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  const win1252 = stripBom(iconv.decode(buffer, "win1252"));

  if (!win1252.includes("\uFFFD")) {
    return win1252;
  }

  return stripBom(iconv.decode(buffer, "latin1"));
}

export function splitDelimitedLine(line, delimiter) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function detectDelimiter(lines) {
  const candidates = [",", ";", "\t", "|"];
  let bestDelimiter = ",";
  let bestScore = -1;

  for (const candidate of candidates) {
    const counts = lines.slice(0, 12).map((line) => splitDelimitedLine(line, candidate).length);
    const positiveCounts = counts.filter((count) => count > 1);
    const score =
      positiveCounts.reduce((total, count) => total + count, 0) +
      (positiveCounts.length > 1 ? 4 : 0) -
      Math.abs((positiveCounts[0] ?? 0) - (positiveCounts[1] ?? positiveCounts[0] ?? 0));

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = candidate;
    }
  }

  return bestDelimiter;
}

export function normalizeHeaderKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findPotentialHeaderRowIndex(rows) {
  for (let index = 0; index < Math.min(rows.length, 5); index += 1) {
    const row = Array.isArray(rows[index]) ? rows[index] : [];
    const nextRow = Array.isArray(rows[index + 1]) ? rows[index + 1] : [];
    const values = row.map((cell) => String(cell ?? "").trim()).filter(Boolean);

    if (values.length < 2) {
      continue;
    }

    const rowLooksLikeLabels = values.every(
      (value) => normalizeDateInput(value) === null && normalizeAmountInput(value) === null,
    );
    const nextRowHasDataSignals = nextRow.some((cell) => {
      const value = String(cell ?? "").trim();
      return Boolean(value) && (normalizeDateInput(value) !== null || normalizeAmountInput(value) !== null);
    });

    if (rowLooksLikeLabels && nextRowHasDataSignals) {
      return index;
    }
  }

  return -1;
}

export function normalizeDateInput(value, options = {}) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const isoWithTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);

  if (isoWithTime) {
    return isoWithTime[1];
  }

  const dateMatch = trimmed.match(/^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})$/);

  if (dateMatch) {
    let day;
    let month;
    let year;

    if (dateMatch[1].length === 4) {
      year = Number(dateMatch[1]);
      month = Number(dateMatch[2]);
      day = Number(dateMatch[3]);
    } else {
      day = Number(dateMatch[1]);
      month = Number(dateMatch[2]);
      const rawYear = Number(dateMatch[3]);
      year = rawYear < 100 ? 2000 + rawYear : rawYear;
    }

    if (
      Number.isInteger(day) &&
      Number.isInteger(month) &&
      Number.isInteger(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const shortDateMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})$/);

  if (shortDateMatch) {
    const day = Number(shortDateMatch[1]);
    const month = Number(shortDateMatch[2]);
    const year = Number.isInteger(options.referenceYear) ? Number(options.referenceYear) : new Date().getUTCFullYear();

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

export function normalizeAmountInput(value) {
  const original = String(value ?? "").trim();

  if (!original) {
    return null;
  }

  let normalized = original.replace(/[R$\s]/gi, "");
  let negative = false;

  if (normalized.startsWith("(") && normalized.endsWith(")")) {
    negative = true;
    normalized = normalized.slice(1, -1);
  }

  if (normalized.startsWith("-")) {
    negative = true;
    normalized = normalized.slice(1);
  }

  if (normalized.endsWith("-")) {
    negative = true;
    normalized = normalized.slice(0, -1);
  }

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (normalized.match(/\./g) ?? []).length;

    if (dotCount > 1) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return negative ? -Math.abs(amount) : amount;
}

export function resolveHeaderIndexes(headers, options = {}) {
  const normalizedHeaders = headers.map(normalizeHeaderKey);
  const findIndex = (aliases) => normalizedHeaders.findIndex((header) => aliases.includes(header));
  const explicitMapping =
    options?.columnMapping && typeof options.columnMapping === "object" ? options.columnMapping : undefined;
  const mappingIndexFor = (key, aliases) => {
    const mappedValue = explicitMapping?.[key];

    if (typeof mappedValue === "number" && mappedValue >= 0 && mappedValue < headers.length) {
      return mappedValue;
    }

    if (typeof mappedValue === "string") {
      const normalizedMappedValue = normalizeHeaderKey(mappedValue);
      const explicitIndex = normalizedHeaders.findIndex((header) => header === normalizedMappedValue);

      if (explicitIndex >= 0) {
        return explicitIndex;
      }
    }

    return findIndex(aliases);
  };

  return {
    date: mappingIndexFor("date", HEADER_ALIASES.date),
    description: mappingIndexFor("description", HEADER_ALIASES.description),
    amount: mappingIndexFor("amount", HEADER_ALIASES.amount),
    debit: mappingIndexFor("debit", HEADER_ALIASES.debit),
    credit: mappingIndexFor("credit", HEADER_ALIASES.credit),
    balance: mappingIndexFor("balance", HEADER_ALIASES.balance),
    type: mappingIndexFor("type", HEADER_ALIASES.type),
    currency: mappingIndexFor("currency", HEADER_ALIASES.currency),
    externalId: mappingIndexFor("externalId", HEADER_ALIASES.externalId),
  };
}

export function scoreHeaderRow(row) {
  const indexes = resolveHeaderIndexes(row);
  let score = 0;

  for (const value of Object.values(indexes)) {
    if (value >= 0) {
      score += 1;
    }
  }

  if (indexes.date >= 0) {
    score += 2;
  }

  if (indexes.description >= 0) {
    score += 2;
  }

  if (indexes.amount >= 0 || (indexes.debit >= 0 && indexes.credit >= 0)) {
    score += 3;
  }

  return score;
}

export function findHeaderRowIndex(rows) {
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const score = scoreHeaderRow(rows[index]);

    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  return bestScore >= 4 ? bestIndex : -1;
}

export function summarizeResolvedMapping(headers, indexes) {
  return Object.fromEntries(
    TABULAR_MAPPING_FIELDS.map((field) => {
      const index = indexes?.[field];
      const headerLabel = typeof index === "number" && index >= 0 ? String(headers[index] ?? "").trim() : null;

      return [
        field,
        {
          index: typeof index === "number" && index >= 0 ? index : null,
          header: headerLabel || null,
        },
      ];
    }),
  );
}

export function getMissingRequiredMappingFields(indexes) {
  const missing = TABULAR_REQUIRED_FIELDS.filter((field) => !Number.isInteger(indexes?.[field]) || indexes[field] < 0);

  const hasAmount = Number.isInteger(indexes?.amount) && indexes.amount >= 0;
  const hasDebitCreditPair =
    Number.isInteger(indexes?.debit) && indexes.debit >= 0 && Number.isInteger(indexes?.credit) && indexes.credit >= 0;

  if (!hasAmount && !hasDebitCreditPair) {
    missing.push("amount");
  }

  return missing;
}

export function isLikelyNoiseText(value) {
  const normalized = normalizeHeaderKey(value);

  if (!normalized) {
    return true;
  }

  return NOISE_TOKENS.some((token) => normalized.includes(token));
}

export function isLikelyNoiseRow(cells) {
  const joined = cells
    .map((cell) => String(cell ?? "").trim())
    .filter(Boolean)
    .join(" ");

  if (!joined) {
    return true;
  }

  return isLikelyNoiseText(joined);
}

export function buildIssue(code, message, severity = "warning") {
  return {
    code,
    message,
    severity,
  };
}
