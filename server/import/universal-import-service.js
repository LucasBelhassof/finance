import {
  createImportPreview,
  MAX_IMPORT_BYTES,
} from "../transaction-import.js";
import { createImportUnsupportedFileError } from "./errors.js";
import { detectFileType } from "./file-type-detector.js";
import { parseCsvLikeBuffer } from "./parsers/csv-parser.js";
import { parseJsonBuffer } from "./parsers/json-parser.js";
import { parseOfxBuffer } from "./parsers/ofx-parser.js";
import { parseQifBuffer } from "./parsers/qif-parser.js";
import { parseSpreadsheetBuffer } from "./parsers/spreadsheet-parser.js";
import { parseTextBuffer } from "./parsers/text-parser.js";
import { setUniversalPreviewMetadata } from "./preview-session-store.js";
import { inferSourceKind } from "./source-kind-detector.js";

function formatAmount(amount) {
  return Number(amount).toFixed(2).replace(".", ",");
}

function serializeCanonicalRowsToCsv(rows) {
  const header = "data,descricao,valor";
  const lines = rows.map((row) => {
    const cells = [
      row.occurredOn,
      `"${String(row.description ?? "").replace(/"/g, '""')}"`,
      formatAmount(row.amount),
    ];
    return cells.join(",");
  });

  return Buffer.from([header, ...lines].join("\n"), "utf8");
}

function resolveParserRows(fileType, fileBuffer) {
  if (fileType === "csv" || fileType === "tsv") {
    return parseCsvLikeBuffer(fileBuffer);
  }

  if (fileType === "json") {
    return parseJsonBuffer(fileBuffer);
  }

  if (fileType === "txt") {
    return parseTextBuffer(fileBuffer);
  }

  if (fileType === "ofx") {
    return parseOfxBuffer(fileBuffer);
  }

  if (fileType === "qif") {
    return parseQifBuffer(fileBuffer);
  }

  if (fileType === "xlsx" || fileType === "xls") {
    return parseSpreadsheetBuffer(fileBuffer);
  }

  throw createImportUnsupportedFileError(fileType);
}

function enrichPreviewResponse(preview, metadata) {
  const items = preview.items.map((item) => ({
    ...item,
    sourceKind: item.importSource,
    issues: [
      ...item.errors.map((message) => ({ level: "error", message })),
      ...item.warnings.map((message) => ({ level: "warning", message })),
    ],
    confidence: item.possibleDuplicate ? 0.55 : 0.85,
  }));

  for (const item of items) {
    if (!item.bankConnectionId && metadata.selectedBankConnectionId) {
      item.bankConnectionId = metadata.selectedBankConnectionId;
    }
  }

  setUniversalPreviewMetadata(preview.previewToken, metadata);

  return {
    ...preview,
    items,
    detectedFileType: metadata.detectedFileType,
    detectedSourceKind: metadata.detectedSourceKind,
    sourceKindConfidence: metadata.sourceKindConfidence,
    selectedBankConnectionId: metadata.selectedBankConnectionId,
    warnings: metadata.warnings,
    fileSummary: {
      ...preview.fileSummary,
      fileName: metadata.filename,
    },
  };
}

export async function createUniversalImportPreview({
  categories,
  existingFingerprints,
  historicalRows,
  recurringRules,
  userId,
  bankConnectionId = null,
  bankConnectionName = null,
  contentType,
  fileBuffer,
  filePassword,
  filename,
  requestedImportSource,
}) {
  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) {
    throw new Error("Nenhum arquivo foi enviado.");
  }

  if (fileBuffer.length > MAX_IMPORT_BYTES) {
    throw new Error("O arquivo excede o limite de 5 MB.");
  }

  const detectedFileType = detectFileType({ contentType, filename, fileBuffer });

  if (detectedFileType === "pdf") {
    const source = inferSourceKind([], { filename, requestedImportSource }).sourceKind;
    const preview = await createImportPreview({
      categories,
      existingFingerprints,
      bankConnectionId,
      bankConnectionName: bankConnectionName ?? "Conta a definir",
      contentType,
      fileBuffer,
      filePassword,
      filename,
      historicalRows,
      importSource: source,
      recurringRules,
      userId,
    });

    return enrichPreviewResponse(preview, {
      detectedFileType,
      detectedSourceKind: preview.importSource,
      sourceKindConfidence: 0.9,
      selectedBankConnectionId: bankConnectionId,
      filename,
      warnings: [],
    });
  }

  if (detectedFileType === "unknown") {
    throw createImportUnsupportedFileError(filename);
  }

  const canonicalRows = resolveParserRows(detectedFileType, fileBuffer);
  const sourceDetection = inferSourceKind(canonicalRows, { filename, requestedImportSource });
  const csvBuffer = serializeCanonicalRowsToCsv(canonicalRows);
  const preview = await createImportPreview({
    categories,
    existingFingerprints,
    bankConnectionId,
    bankConnectionName: bankConnectionName ?? "Conta a definir",
    contentType: "text/csv",
    fileBuffer: csvBuffer,
    filePassword: undefined,
    filename: String(filename ?? "importacao.csv").replace(/\.[^.]+$/, ".csv"),
    historicalRows,
    importSource: sourceDetection.sourceKind,
    recurringRules,
    userId,
  });

  preview.items.forEach((item, index) => {
    item.sourceRow = canonicalRows[index]?.sourceRow ?? item.sourceRow;
    if (!bankConnectionId) {
      item.bankConnectionId = "";
      item.bankConnectionName = "Conta a definir";
    }
  });

  return enrichPreviewResponse(preview, {
    detectedFileType,
    detectedSourceKind: sourceDetection.sourceKind,
    sourceKindConfidence: sourceDetection.confidence,
    selectedBankConnectionId: bankConnectionId,
    filename,
    warnings: sourceDetection.warnings,
  });
}
