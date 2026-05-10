const IMPORT_MAPPING_FIELDS = ["date", "description", "amount", "debit", "credit", "balance", "currency", "externalId"];

function normalizeHeaderKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeImportTemplateName(value, fallback = "Saved import template") {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, 120);
}

export function buildImportHeaderSignature(availableColumns = []) {
  return availableColumns
    .map((column, index) => {
      const normalizedHeader = normalizeHeaderKey(column?.normalizedHeader ?? column?.header ?? "");
      return normalizedHeader || `column_${index + 1}`;
    })
    .join("|");
}

export function normalizeImportTemplateColumnMapping(mapping) {
  if (!mapping || typeof mapping !== "object") {
    return {};
  }

  return Object.fromEntries(
    IMPORT_MAPPING_FIELDS.map((field) => [field, String(mapping[field] ?? "").trim()]).filter(
      ([, value]) => value.length > 0,
    ),
  );
}

export function hasImportTemplateAmountMapping(mapping) {
  return Boolean(mapping.amount) || (Boolean(mapping.debit) && Boolean(mapping.credit));
}

export function validateImportTemplateColumnMapping(mapping) {
  const normalized = normalizeImportTemplateColumnMapping(mapping);

  if (!normalized.date || !normalized.description) {
    throw new Error("O template precisa mapear date e description.");
  }

  if (!hasImportTemplateAmountMapping(normalized)) {
    throw new Error("O template precisa mapear amount ou debit e credit.");
  }

  return normalized;
}
