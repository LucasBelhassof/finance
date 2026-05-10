import * as XLSX from "xlsx";

import { analyzeTabularGrid, normalizeTabularGrid } from "./csv-parser.js";

function scoreSheet(rows) {
  if (!rows.length) {
    return 0;
  }

  const parsedRows = normalizeTabularGrid(rows, { source: "sheet-preview" });
  return parsedRows.length * 4 + parsedRows.filter((row) => row.issues.length === 0).length * 2;
}

export function parseSpreadsheetBuffer(fileBuffer) {
  return analyzeSpreadsheetBuffer(fileBuffer).rows;
}

export function analyzeSpreadsheetBuffer(fileBuffer, options = {}) {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: false,
    dense: true,
  });
  let bestRows = [];
  let bestScore = -1;
  let bestSheetName = null;
  const sheetCandidates = [];

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
    const analyzedGrid = analyzeTabularGrid(grid, {
      source: sheetName,
      columnMapping: options.columnMapping,
    });
    sheetCandidates.push({
      sheetName,
      score,
      availableColumns: analyzedGrid.preflight.availableColumns,
      missingRequiredFields: analyzedGrid.preflight.missingRequiredFields,
      requiresManualMapping: analyzedGrid.preflight.requiresManualMapping,
    });

    if (options.sheetName && sheetName !== options.sheetName) {
      continue;
    }

    if (score <= bestScore) {
      continue;
    }

    const rows = normalizeTabularGrid(grid, {
      source: sheetName,
      columnMapping: options.columnMapping,
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
      bestSheetName = sheetName;
    }
  }

  return {
    rows: bestRows,
    metadata: {
      selectedSheetName: bestSheetName,
      sheetCandidates,
      preflight:
        bestSheetName && workbook.Sheets[bestSheetName]
          ? analyzeTabularGrid(
              XLSX.utils.sheet_to_json(workbook.Sheets[bestSheetName], {
                header: 1,
                defval: "",
                raw: false,
                blankrows: false,
              }),
              {
                source: bestSheetName,
                columnMapping: options.columnMapping,
              },
            ).preflight
          : null,
    },
  };
}
