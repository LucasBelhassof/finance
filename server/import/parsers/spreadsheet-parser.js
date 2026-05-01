import * as XLSX from "xlsx";

import { normalizeTabularGrid } from "./csv-parser.js";

function scoreSheet(rows) {
  if (!rows.length) {
    return 0;
  }

  const parsedRows = normalizeTabularGrid(rows, { source: "sheet-preview" });
  return parsedRows.length * 4 + parsedRows.filter((row) => row.issues.length === 0).length * 2;
}

export function parseSpreadsheetBuffer(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: false,
    dense: true,
  });
  let bestRows = [];
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      continue;
    }

    const grid = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (!Array.isArray(grid) || grid.length === 0) {
      continue;
    }

    const score = scoreSheet(grid);

    if (score <= bestScore) {
      continue;
    }

    const rows = normalizeTabularGrid(grid, {
      source: sheetName,
    }).map((row) => ({
      ...row,
      raw: {
        ...row.raw,
        source: sheetName,
      },
      sourceRow: {
        ...(row.sourceRow ?? {}),
        source: sheetName,
      },
    }));

    if (rows.length > 0) {
      bestRows = rows;
      bestScore = score;
    }
  }

  return bestRows;
}
