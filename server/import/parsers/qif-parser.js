import { normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

export function parseQifBuffer(fileBuffer) {
  const lines = fileBuffer.toString("utf8").split(/\r?\n/);
  const rows = [];
  let current = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line === "^") {
      const occurredOn = normalizeDateInput(current.date);
      const description = String(current.payee ?? current.description ?? current.memo ?? "").trim();
      const amount = normalizeAmountInput(current.amount);

      if (occurredOn && description && amount !== null) {
        rows.push({
          occurredOn,
          description,
          amount,
          category: current.category ?? null,
          memo: current.memo ?? null,
          confidence: 0.9,
          issues: [],
          sourceRow: {
            category: current.category ?? null,
            memo: current.memo ?? null,
            source: "QIF",
          },
          raw: {
            source: "QIF",
            text: current.raw ?? null,
          },
        });
      }

      current = {};
      continue;
    }

    const prefix = line.charAt(0);
    const value = line.slice(1).trim();
    current.raw = `${current.raw ?? ""}${line}\n`;

    if (prefix === "D") {
      current.date = value;
    } else if (prefix === "T") {
      current.amount = value;
    } else if (prefix === "P") {
      current.payee = value;
    } else if (prefix === "M") {
      current.memo = value;
    } else if (prefix === "L") {
      current.category = value;
    }
  }

  return rows;
}
