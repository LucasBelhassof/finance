import { normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    for (const key of ["transactions", "items", "data", "rows"]) {
      if (Array.isArray(value[key])) {
        return value[key];
      }
    }
  }

  return [];
}

export function parseJsonBuffer(fileBuffer) {
  const parsed = JSON.parse(fileBuffer.toString("utf8"));
  const rows = [];

  for (const entry of toArray(parsed)) {
    const occurredOn = normalizeDateInput(entry.date ?? entry.occurredOn ?? entry.postedAt ?? entry.posted_on);
    const description = String(entry.description ?? entry.memo ?? entry.title ?? "").trim();
    const amount = normalizeAmountInput(entry.amount ?? entry.value ?? entry.signedAmount);
    const type = String(entry.type ?? "").trim().toLowerCase();

    if (!occurredOn || !description || amount === null) {
      continue;
    }

    rows.push({
      occurredOn,
      description,
      amount: type === "expense" || type === "debit" ? -Math.abs(amount) : type === "income" || type === "credit" ? Math.abs(amount) : amount,
      sourceRow: entry,
    });
  }

  return rows;
}
