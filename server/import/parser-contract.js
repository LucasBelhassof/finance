function sanitizeParserWarning(warning) {
  const normalized = String(warning ?? "").trim();
  return normalized ? normalized.slice(0, 240) : null;
}

function sanitizeParserMetadata(metadata) {
  return metadata && typeof metadata === "object" ? metadata : {};
}

export function normalizeConfidence(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    return null;
  }

  return normalized;
}

function pickIssueLevel(issue) {
  if (issue?.level === "error" || issue?.severity === "error") {
    return "error";
  }

  return "warning";
}

function inferIssueField(issue) {
  const explicitField = String(issue?.field ?? "").trim();

  if (explicitField) {
    return explicitField.slice(0, 80);
  }

  const code = String(issue?.code ?? "").trim();

  if (code.includes("date")) {
    return "occurredOn";
  }

  if (code.includes("amount")) {
    return "amount";
  }

  if (code.includes("description")) {
    return "description";
  }

  if (code.includes("source_kind")) {
    return "sourceKind";
  }

  return null;
}

function inferSuggestedAction(issue) {
  const explicitAction = String(issue?.suggestedAction ?? "").trim();

  if (explicitAction) {
    return explicitAction.slice(0, 160);
  }

  const code = String(issue?.code ?? "").trim();

  switch (code) {
    case "import_inferred_date":
      return "Review the inferred date before importing.";
    case "import_missing_date":
      return "Set the transaction date before importing.";
    case "import_missing_amount":
      return "Set the transaction amount before importing.";
    case "import_missing_description":
      return "Set the transaction description before importing.";
    default:
      return null;
  }
}

export function normalizeImportIssue(issue, defaults = {}) {
  const message = String(issue?.message ?? "").trim();

  if (!message) {
    return null;
  }

  const level = pickIssueLevel(issue);
  const code = String(issue?.code ?? "").trim();
  const provenance = String(issue?.provenance ?? defaults.provenance ?? "parser").trim();

  return {
    code: code ? code.slice(0, 80) : null,
    level,
    severity: level,
    field: inferIssueField(issue),
    message: message.slice(0, 240),
    suggestedAction: inferSuggestedAction(issue),
    provenance: provenance ? provenance.slice(0, 40) : "parser",
  };
}

function normalizeCanonicalRow(row, index) {
  const normalizedRow = row && typeof row === "object" ? { ...row } : {};
  const amount = Number(normalizedRow.amount);
  const balanceAfter = normalizedRow.balanceAfter === null ? null : Number(normalizedRow.balanceAfter);
  const confidence = normalizeConfidence(normalizedRow.confidence);

  return {
    ...normalizedRow,
    rowId: String(normalizedRow.rowId ?? index + 1),
    occurredOn: normalizedRow.occurredOn ?? null,
    description: String(normalizedRow.description ?? "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: normalizedRow.currency ? String(normalizedRow.currency).trim() : null,
    balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : null,
    externalId: normalizedRow.externalId ? String(normalizedRow.externalId).trim() : null,
    sourceKindHint: normalizedRow.sourceKindHint ?? normalizedRow.sourceKind ?? null,
    confidence,
    issues: Array.isArray(normalizedRow.issues)
      ? normalizedRow.issues.map((issue) => normalizeImportIssue(issue, { provenance: "parser" })).filter(Boolean)
      : [],
    sourceRow: normalizedRow.sourceRow && typeof normalizedRow.sourceRow === "object" ? normalizedRow.sourceRow : {},
    rawMetadata:
      normalizedRow.rawMetadata && typeof normalizedRow.rawMetadata === "object" ? normalizedRow.rawMetadata : null,
    institutionName: normalizedRow.institutionName ? String(normalizedRow.institutionName).trim() : null,
    accountHint: normalizedRow.accountHint ?? normalizedRow.bankAccountHint ?? null,
    raw: normalizedRow.raw && typeof normalizedRow.raw === "object" ? normalizedRow.raw : {},
  };
}

export function normalizeCanonicalParserResult(parsedResult, parserEntry, detectedFileType) {
  const parsedObject =
    Array.isArray(parsedResult) || !parsedResult || typeof parsedResult !== "object"
      ? { rows: parsedResult }
      : parsedResult;
  const rows = (Array.isArray(parsedObject.rows) ? parsedObject.rows : []).map((row, index) =>
    normalizeCanonicalRow(row, index),
  );

  return {
    parserId: parsedObject.parserId ? String(parsedObject.parserId).trim() : parserEntry.parserId,
    parserLabel: parsedObject.parserLabel ? String(parsedObject.parserLabel).trim() : parserEntry.parserLabel,
    detectedFileType,
    rows,
    warnings: Array.isArray(parsedObject.warnings)
      ? parsedObject.warnings.map(sanitizeParserWarning).filter(Boolean)
      : [],
    metadata: sanitizeParserMetadata(parsedObject.metadata),
    sourceKind: parsedObject.sourceKind ?? null,
    sourceKindConfidence: normalizeConfidence(parsedObject.sourceKindConfidence),
    accountHint: parsedObject.accountHint ?? null,
  };
}
