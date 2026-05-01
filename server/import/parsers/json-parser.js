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

function resolveSignedAmount(entry) {
  const amount = normalizeAmountInput(entry.amount ?? entry.value ?? entry.signedAmount);

  if (amount !== null) {
    const type = String(entry.type ?? "").trim().toLowerCase();

    if (type === "expense" || type === "debit") {
      return -Math.abs(amount);
    }

    if (type === "income" || type === "credit") {
      return Math.abs(amount);
    }

    return amount;
  }

  const debit = normalizeAmountInput(entry.debit);
  const credit = normalizeAmountInput(entry.credit);

  if (credit !== null && Math.abs(credit) > 0) {
    return Math.abs(credit);
  }

  if (debit !== null && Math.abs(debit) > 0) {
    return -Math.abs(debit);
  }

  return null;
}

export function parseJsonBuffer(fileBuffer) {
  const parsed = JSON.parse(fileBuffer.toString("utf8"));
  const rows = [];

  for (const entry of toArray(parsed)) {
    const occurredOn = normalizeDateInput(entry.date ?? entry.occurredOn ?? entry.postedOn ?? entry.posted_on ?? entry.postedAt);
    const description = String(entry.description ?? entry.memo ?? entry.title ?? entry.name ?? "").trim();
    const amount = resolveSignedAmount(entry);

    if (!occurredOn || !description || amount === null) {
      continue;
    }

    rows.push({
      occurredOn,
      description,
      amount,
      currency: entry.currency ?? null,
      externalId: entry.externalId ?? entry.external_id ?? entry.id ?? entry.fitid ?? null,
      confidence: 0.9,
      issues: [],
      sourceRow: entry,
      raw: {
        source: "json",
      },
    });
  }

  return rows;
}
