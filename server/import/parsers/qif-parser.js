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
      const description = String(current.description ?? "").trim();
      const amount = normalizeAmountInput(current.amount);

      if (occurredOn && description && amount !== null) {
        rows.push({
          occurredOn,
          description,
          amount,
          sourceRow: current,
        });
      }

      current = {};
      continue;
    }

    const prefix = line.charAt(0);
    const value = line.slice(1).trim();

    if (prefix === "D") {
      current.date = value;
    } else if (prefix === "T") {
      current.amount = value;
    } else if (prefix === "P") {
      current.description = value;
    } else if (prefix === "M" && !current.description) {
      current.description = value;
    }
  }

  return rows;
}
