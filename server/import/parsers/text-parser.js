import { decodeTextBuffer, normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

export function parseTextBuffer(fileBuffer) {
  const lines = decodeTextBuffer(fileBuffer)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = [];

  for (const line of lines) {
    const match = line.match(/^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\s+(.+?)\s+(-?[\d.,]+)$/);

    if (!match) {
      continue;
    }

    const occurredOn = normalizeDateInput(match[1]);
    const description = match[2]?.trim();
    const amount = normalizeAmountInput(match[3]);

    if (!occurredOn || !description || amount === null) {
      continue;
    }

    rows.push({
      occurredOn,
      description,
      amount,
      sourceRow: { raw: line },
    });
  }

  return rows;
}
