import crypto from "node:crypto";

import { createImportPreview, MAX_IMPORT_BYTES } from "../transaction-import.js";
import { createImportUnsupportedFileError } from "./errors.js";
import { detectFileType } from "./file-type-detector.js";
import { normalizeCanonicalParserResult, normalizeConfidence, normalizeImportIssue } from "./parser-contract.js";
import { resolveUniversalImportParser } from "./parser-registry.js";
import { setUniversalPreviewMetadata, setUniversalPreviewSession } from "./preview-session-store.js";
import { inferSourceKind } from "./source-kind-detector.js";

function formatAmount(amount) {
  return Number(amount).toFixed(2).replace(".", ",");
}

function serializeCanonicalRowsToCsv(rows) {
  const header = "data;descricao;valor";
  const lines = rows.map((row) => {
    const cells = [row.occurredOn, `"${String(row.description ?? "").replace(/"/g, '""')}"`, formatAmount(row.amount)];
    return cells.join(";");
  });

  return Buffer.from([header, ...lines].join("\n"), "utf8");
}

function resolveParsedFile(fileType, input) {
  const parser = resolveUniversalImportParser(fileType);

  if (!parser) {
    throw createImportUnsupportedFileError(input.filename);
  }

  return parser.parse(input);
}

function pickBoundedString(value, maxLength = 120) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function buildSafeRawMetadata(canonicalRow) {
  const raw = canonicalRow?.raw ?? {};
  const sourceRow = canonicalRow?.sourceRow ?? {};
  const keys = [
    "source",
    "sheetName",
    "sheet",
    "page",
    "pageNumber",
    "lineNumber",
    "rowNumber",
    "fitid",
    "externalId",
    "currency",
  ];
  const metadata = {};

  for (const key of keys) {
    const value = raw[key] ?? sourceRow[key];
    const safeValue = pickBoundedString(value);

    if (safeValue) {
      metadata[key] = safeValue;
    }
  }

  if (Array.isArray(raw?.cells)) {
    metadata.columnCount = raw.cells.length;
  }

  const headerKeys = Object.keys(sourceRow)
    .filter((key) => !["memo", "text", "raw"].includes(key))
    .slice(0, 12);

  if (headerKeys.length > 0) {
    metadata.headerKeys = headerKeys;
  }

  return metadata;
}

function buildSafeRawFallbackHash(canonicalRow) {
  const payload = {
    metadata: buildSafeRawMetadata(canonicalRow),
    rawTextHash: pickBoundedString(canonicalRow?.raw?.text)
      ? crypto.createHash("sha256").update(String(canonicalRow.raw.text)).digest("hex")
      : null,
    sourceRowHash:
      canonicalRow?.sourceRow && typeof canonicalRow.sourceRow === "object"
        ? crypto.createHash("sha256").update(JSON.stringify(canonicalRow.sourceRow)).digest("hex")
        : null,
    cellsHash: Array.isArray(canonicalRow?.raw?.cells)
      ? crypto.createHash("sha256").update(JSON.stringify(canonicalRow.raw.cells)).digest("hex")
      : null,
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function dedupeIssues(issues) {
  const seen = new Set();

  return issues.filter((issue) => {
    const key = [issue.level, issue.code ?? "", issue.field ?? "", issue.message].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toPreviewIssue(issue, defaults = {}) {
  const normalized = normalizeImportIssue(issue, defaults);

  if (!normalized) {
    return null;
  }

  return {
    code: normalized.code,
    level: normalized.level,
    severity: normalized.severity,
    field: normalized.field,
    message: normalized.message,
    suggestedAction: normalized.suggestedAction,
    provenance: normalized.provenance,
  };
}

function normalizePreviewIssueMessages(level, messages, defaults = {}) {
  return messages
    .map((message) =>
      toPreviewIssue(
        {
          level,
          severity: level,
          message,
        },
        defaults,
      ),
    )
    .filter(Boolean);
}

function buildPreviewIssues(item, canonicalRow) {
  const parserIssues = (canonicalRow?.issues ?? [])
    .map((issue) => toPreviewIssue(issue, { provenance: "parser" }))
    .filter(Boolean);
  const compatibilityErrors = normalizePreviewIssueMessages("error", item.errors ?? [], { provenance: "preview" });
  const compatibilityWarnings = normalizePreviewIssueMessages("warning", item.warnings ?? [], {
    provenance: "preview",
  });

  return dedupeIssues([...compatibilityErrors, ...compatibilityWarnings, ...parserIssues]);
}

function buildPreviewConfidence(item, canonicalRow) {
  const parserConfidence = normalizeConfidence(canonicalRow?.confidence);

  if (parserConfidence !== null) {
    return parserConfidence;
  }

  return item.possibleDuplicate ? 0.55 : 0.85;
}

function buildMappingPreflight(parsedResult) {
  const preflight = parsedResult.preflight ?? parsedResult.metadata?.preflight ?? null;

  if (!preflight) {
    return null;
  }

  return {
    supported: Boolean(preflight.supported),
    strategy: preflight.strategy ?? "tabular_columns",
    delimiter: preflight.delimiter ?? null,
    headerRowIndex: preflight.headerRowIndex ?? null,
    headerDetectionMode: preflight.headerDetectionMode ?? "none",
    availableColumns: Array.isArray(preflight.availableColumns) ? preflight.availableColumns : [],
    sampleRows: Array.isArray(preflight.sampleRows) ? preflight.sampleRows : [],
    selectedMapping: preflight.selectedMapping ?? {},
    missingRequiredFields: Array.isArray(preflight.missingRequiredFields) ? preflight.missingRequiredFields : [],
    requiresManualMapping: Boolean(preflight.requiresManualMapping),
    canApplyMapping: Boolean(preflight.canApplyMapping),
    sheetCandidates: Array.isArray(parsedResult.metadata?.sheetCandidates) ? parsedResult.metadata.sheetCandidates : [],
    selectedSheetName: parsedResult.metadata?.selectedSheetName ?? null,
  };
}

function buildUniversalSession({
  preview,
  metadata,
  items,
  canonicalRows,
  selectedBankConnectionId,
  detectedSourceKind,
  userId,
}) {
  const expiresAtMs = Date.parse(preview.expiresAt);

  return {
    kind: "universal",
    previewToken: preview.previewToken,
    userId: String(userId),
    createdAtMs: Date.now(),
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 15 * 60 * 1000,
    parserId: metadata.parserId,
    parserLabel: metadata.parserLabel,
    detectedFileType: metadata.detectedFileType,
    detectedSourceKind,
    selectedBankConnectionId,
    filename: metadata.filename ?? null,
    institutionName: metadata.institutionName ?? null,
    accountHint: metadata.accountHint ?? null,
    fileMetadata: preview.fileMetadata ?? {},
    warnings: Array.isArray(metadata.warnings) ? metadata.warnings : [],
    items: items.map((item, index) => {
      const canonicalRow = canonicalRows[index] ?? null;
      const normalizedIssues = (item.issues ?? [])
        .map((issue) => toPreviewIssue(issue, { provenance: "preview" }))
        .filter(Boolean);

      return {
        rowIndex: item.rowIndex,
        original: { ...item },
        aiSuggestion: null,
        commitData: {
          rowIndex: item.rowIndex,
          occurredOn: item.occurredOn ?? canonicalRow?.occurredOn ?? null,
          description: item.description ?? canonicalRow?.description ?? null,
          amount: item.amount ?? canonicalRow?.amount ?? null,
          signedAmount: item.signedAmount ?? canonicalRow?.amount ?? null,
          type: item.type ?? (Number(canonicalRow?.amount) < 0 ? "expense" : "income"),
          sourceKind: item.sourceKind ?? detectedSourceKind ?? "unknown",
          suggestedCategoryId: item.suggestedCategoryId ?? null,
          selectedBankConnectionId:
            item.bankConnectionId === "" || item.bankConnectionId === undefined || item.bankConnectionId === null
              ? (selectedBankConnectionId ?? null)
              : Number(item.bankConnectionId),
          defaultExclude: Boolean(item.defaultExclude),
          possibleDuplicate: Boolean(item.possibleDuplicate),
          duplicateReason: item.possibleDuplicate ? "preview_duplicate" : null,
          externalId: canonicalRow?.externalId ? String(canonicalRow.externalId) : null,
          confidence: normalizeConfidence(item.confidence),
          issues: normalizedIssues,
          rawMetadata: buildSafeRawMetadata(canonicalRow),
          rawFallbackHash: buildSafeRawFallbackHash(canonicalRow),
          isInstallment: Boolean(item.isInstallment),
          purchaseOccurredOn: item.purchaseOccurredOn ?? null,
          purchaseDescriptionBase: item.purchaseDescriptionBase ?? null,
          normalizedPurchaseDescriptionBase: item.normalizedPurchaseDescriptionBase ?? null,
          installmentIndex: Number.isInteger(Number(item.installmentIndex)) ? Number(item.installmentIndex) : null,
          installmentCount: Number.isInteger(Number(item.installmentCount)) ? Number(item.installmentCount) : null,
          generatedInstallmentCount: Number.isInteger(Number(item.generatedInstallmentCount))
            ? Number(item.generatedInstallmentCount)
            : null,
          parserId: metadata.parserId,
          parserLabel: metadata.parserLabel,
        },
      };
    }),
  };
}

async function enrichPreviewResponse(preview, metadata, canonicalRows) {
  const items = preview.items.map((item, index) => {
    const canonicalRow = canonicalRows[index];
    const issues = buildPreviewIssues(item, canonicalRow);
    const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.message);
    const errors = issues.filter((issue) => issue.level === "error").map((issue) => issue.message);

    return {
      ...item,
      sourceKind: metadata.detectedSourceKind,
      sourceRow: canonicalRow?.sourceRow ?? item.sourceRow,
      warnings,
      errors,
      issues,
      confidence: buildPreviewConfidence(item, canonicalRow),
      externalId: canonicalRow?.externalId ?? null,
      rawMetadata: buildSafeRawMetadata(canonicalRow),
    };
  });

  await setUniversalPreviewMetadata(preview.previewToken, metadata);

  const warningRows = items.filter((item) => item.issues.some((issue) => issue.level === "warning")).length;
  const errorRows = items.filter((item) => item.issues.some((issue) => issue.level === "error")).length;

  const response = {
    ...preview,
    items,
    parserId: metadata.parserId,
    parserLabel: metadata.parserLabel,
    detectedFileType: metadata.detectedFileType,
    detectedSourceKind: metadata.detectedSourceKind,
    sourceKindConfidence: normalizeConfidence(metadata.sourceKindConfidence),
    requiresManualMapping: Boolean(metadata.mappingPreflight?.requiresManualMapping),
    mappingPreflight: metadata.mappingPreflight ?? null,
    selectedBankConnectionId: metadata.selectedBankConnectionId,
    institutionName: metadata.institutionName,
    accountHint: metadata.accountHint,
    warnings: metadata.warnings,
    fileMetadata: {
      ...preview.fileMetadata,
      statementReferenceMonth: metadata.statementReferenceMonth ?? preview.fileMetadata.statementReferenceMonth,
      statementDueDate: metadata.statementDueDate ?? preview.fileMetadata.statementDueDate,
    },
    fileSummary: {
      ...preview.fileSummary,
      errorRows,
      warningRows,
      actionRequiredRows: items.filter((item) => item.issues.length > 0 || item.requiresUserAction).length,
    },
  };

  await setUniversalPreviewSession(
    preview.previewToken,
    buildUniversalSession({
      preview: response,
      metadata,
      items,
      canonicalRows,
      selectedBankConnectionId: metadata.selectedBankConnectionId ?? null,
      detectedSourceKind: metadata.detectedSourceKind,
      userId: metadata.userId,
    }),
  );

  return response;
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
  previewOptions,
  requestedImportSource,
}) {
  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) {
    throw new Error("Nenhum arquivo foi enviado.");
  }

  if (fileBuffer.length > MAX_IMPORT_BYTES) {
    throw new Error("O arquivo excede o limite de 5 MB.");
  }

  const detectedFileType = detectFileType({ contentType, filename, fileBuffer });

  if (detectedFileType === "unknown") {
    throw createImportUnsupportedFileError(filename);
  }

  const parserEntry = resolveUniversalImportParser(detectedFileType);

  if (!parserEntry) {
    throw createImportUnsupportedFileError(filename);
  }

  const parsedResult = normalizeCanonicalParserResult(
    await resolveParsedFile(detectedFileType, {
      fileBuffer,
      filePassword,
      filename,
      contentType,
      previewOptions,
    }),
    parserEntry,
    detectedFileType,
  );
  const canonicalRows = parsedResult.rows;

  if (canonicalRows.length === 0) {
    throw new Error("Não foi possível localizar transações válidas no arquivo.");
  }

  const sourceDetection = inferSourceKind(canonicalRows, {
    filename,
    requestedImportSource,
    issuerName: parsedResult.metadata?.issuerName ?? null,
  });
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
    importSource: sourceDetection.sourceKind === "credit_card_statement" ? "credit_card_statement" : "bank_statement",
    recurringRules,
    userId,
  });

  preview.items.forEach((item) => {
    if (!bankConnectionId) {
      item.bankConnectionId = "";
      item.bankConnectionName = "Conta a definir";
    }
  });

  return await enrichPreviewResponse(
    preview,
    {
      parserId: parsedResult.parserId,
      parserLabel: parsedResult.parserLabel,
      detectedFileType: parsedResult.detectedFileType,
      detectedSourceKind: sourceDetection.sourceKind,
      sourceKindConfidence:
        normalizeConfidence(parsedResult.sourceKindConfidence) ?? normalizeConfidence(sourceDetection.confidence),
      selectedBankConnectionId: bankConnectionId,
      filename,
      institutionName: parsedResult.metadata?.issuerName ?? null,
      accountHint:
        parsedResult.accountHint ??
        canonicalRows.find((row) => row.bankAccountHint)?.bankAccountHint?.accountId ??
        null,
      statementReferenceMonth: parsedResult.metadata?.statementReferenceMonth ?? null,
      statementDueDate: parsedResult.metadata?.statementDueDate ?? null,
      warnings: [...parsedResult.warnings, ...sourceDetection.warnings],
      mappingPreflight: buildMappingPreflight(parsedResult),
      userId,
    },
    canonicalRows,
  );
}
