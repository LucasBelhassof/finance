import * as XLSX from "xlsx";

import { normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

export function parseSpreadsheetBuffer(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: false,
    dense: true,
  });
  const rows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    const jsonRows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    for (const entry of jsonRows) {
      const occurredOn = normalizeDateInput(entry.Data ?? entry.data ?? entry.Date ?? entry.date ?? entry.occurredOn);
      const description = String(entry.Descricao ?? entry.descricao ?? entry.Description ?? entry.description ?? entry.Historico ?? "").trim();
      const amount = normalizeAmountInput(
        entry.Valor ?? entry.valor ?? entry.Amount ?? entry.amount ?? entry.Debito ?? entry.Credito ?? entry.debito ?? entry.credito,
      );

      if (!occurredOn || !description || amount === null) {
        continue;
      }

      rows.push({
        occurredOn,
        description,
        amount,
        sourceRow: { ...entry, sheetName },
      });
    }
  }

  return rows;
}
