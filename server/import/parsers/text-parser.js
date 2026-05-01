import { buildIssue, decodeTextBuffer, isLikelyNoiseText, normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

const TEXT_PATTERNS = [
  /^(?<date>\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4})\s+(?<description>.+?)\s+(?<amount>-?(?:R\$\s*)?[\d.,]+)$/i,
  /^(?<date>\d{1,2}[\/.-]\d{1,2})\s+(?<description>.+?)\s+(?<amount>-?(?:R\$\s*)?[\d.,]+)$/i,
  /^(?<description>.+?)\s+(?<date>\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4})\s+(?<amount>-?(?:R\$\s*)?[\d.,]+)$/i,
  /^(?<description>.+?)\s+(?<date>\d{1,2}[\/.-]\d{1,2})\s+(?<amount>-?(?:R\$\s*)?[\d.,]+)$/i,
];

function parseTextLine(line, referenceYear) {
  for (const pattern of TEXT_PATTERNS) {
    const match = line.match(pattern);

    if (!match?.groups) {
      continue;
    }

    const occurredOn = normalizeDateInput(match.groups.date, { referenceYear });
    const amount = normalizeAmountInput(match.groups.amount);
    const description = String(match.groups.description ?? "").trim();

    if (!occurredOn || amount === null || !description) {
      continue;
    }

    return {
      occurredOn,
      description,
      amount,
      confidence: match.groups.date.length <= 5 ? 0.62 : 0.82,
      issues:
        match.groups.date.length <= 5
          ? [buildIssue("import_inferred_year", "O ano desta linha foi inferido a partir do contexto do arquivo.", "warning")]
          : [],
      sourceRow: { raw: line },
      raw: {
        source: "text",
        text: line,
      },
    };
  }

  return null;
}

export function parseTextLines(lines, options = {}) {
  const referenceYear = Number.isInteger(options.referenceYear) ? options.referenceYear : new Date().getUTCFullYear();

  return lines
    .map((rawLine) => String(rawLine ?? "").trim())
    .filter(Boolean)
    .filter((line) => !isLikelyNoiseText(line))
    .map((line) => parseTextLine(line, referenceYear))
    .filter(Boolean);
}

export function parseTextBuffer(fileBuffer, options = {}) {
  const lines = decodeTextBuffer(fileBuffer).split(/\r?\n/);
  return parseTextLines(lines, options);
}
