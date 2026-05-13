const validInstallmentUpdateScopes = new Set(["current", "all", "future", "past", "custom"]);

function normalizeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDateOnly(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function parseDateOnly(value) {
  const normalized = normalizeDateOnly(value);

  if (!normalized) {
    return null;
  }

  return new Date(`${normalized}T12:00:00Z`);
}

function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

function addMonthsClamped(value, months) {
  const date = parseDateOnly(value);

  if (!date) {
    return null;
  }

  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const originalDay = date.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 12)).getUTCDate();
  const nextDate = new Date(Date.UTC(targetYear, targetMonth, Math.min(originalDay, lastDayOfMonth), 12));

  return toDateOnlyString(nextDate);
}

function normalizeInstallmentUpdateScope(scope) {
  return validInstallmentUpdateScopes.has(scope) ? scope : "current";
}

export function buildTransactionCategorySyncPlan(transaction, nextCategoryId) {
  const currentCategoryId = normalizeInteger(transaction?.category_id ?? transaction?.categoryId ?? null);
  const installmentPurchaseId = transaction?.installment_purchase_id ?? transaction?.installmentPurchaseId ?? null;

  if (!installmentPurchaseId || !Number.isInteger(currentCategoryId) || currentCategoryId === Number(nextCategoryId)) {
    return {
      syncInstallmentPurchase: false,
      installmentPurchaseId: null,
    };
  }

  return {
    syncInstallmentPurchase: true,
    installmentPurchaseId,
  };
}

export function buildInstallmentFieldChangeSet(transaction, nextValues) {
  const currentDescription = String(transaction?.description ?? "").trim();
  const currentAmount = Number(transaction?.amount);
  const currentOccurredOn = normalizeDateOnly(transaction?.occurred_on ?? transaction?.occurredOn ?? null);
  const currentBankConnectionId = normalizeInteger(
    transaction?.bank_connection_id ?? transaction?.bankConnectionId ?? null,
  );
  const currentCategoryId = normalizeInteger(transaction?.category_id ?? transaction?.categoryId ?? null);

  const nextDescription = String(nextValues?.description ?? "").trim();
  const nextAmount = Number(nextValues?.amount);
  const nextOccurredOn = normalizeDateOnly(nextValues?.occurredOn ?? null);
  const nextBankConnectionId = normalizeInteger(nextValues?.bankConnectionId ?? null);
  const nextCategoryId = normalizeInteger(nextValues?.categoryId ?? null);

  const changedFields = {
    description: currentDescription !== nextDescription,
    amount: Number.isFinite(currentAmount) && Number.isFinite(nextAmount) ? currentAmount !== nextAmount : true,
    occurredOn: currentOccurredOn !== nextOccurredOn,
    bankConnectionId: currentBankConnectionId !== nextBankConnectionId,
    categoryId: currentCategoryId !== nextCategoryId,
  };

  return {
    ...changedFields,
    hasChanges: Object.values(changedFields).some(Boolean),
  };
}

export function resolveInstallmentUpdateSelection(transaction, bundleRows, rawScope, rawInstallmentNumbers = []) {
  const scope = normalizeInstallmentUpdateScope(rawScope);
  const transactionId = transaction?.id ?? null;
  const currentInstallmentNumber = normalizeInteger(
    transaction?.installment_number ?? transaction?.installmentNumber ?? null,
  );
  const rows = Array.isArray(bundleRows) ? bundleRows : [];
  const normalizedRows = rows
    .map((row) => ({
      ...row,
      installment_number: normalizeInteger(row?.installment_number ?? row?.installmentNumber ?? null),
    }))
    .filter((row) => Number.isInteger(row.installment_number));

  const currentRow =
    normalizedRows.find((row) => String(row.id) === String(transactionId)) ??
    normalizedRows.find((row) => row.installment_number === currentInstallmentNumber) ??
    null;

  if (!currentRow || !Number.isInteger(currentInstallmentNumber)) {
    return {
      scope: "current",
      targetRows: currentRow ? [currentRow] : [],
      targetInstallmentNumbers: currentRow ? [currentRow.installment_number] : [],
      fullBundleSelected: normalizedRows.length > 0 && normalizedRows.length === 1,
    };
  }

  let targetRows = [];

  if (scope === "all") {
    targetRows = normalizedRows;
  } else if (scope === "future") {
    targetRows = normalizedRows.filter((row) => row.installment_number >= currentInstallmentNumber);
  } else if (scope === "past") {
    targetRows = normalizedRows.filter((row) => row.installment_number <= currentInstallmentNumber);
  } else if (scope === "custom") {
    const selectedInstallmentNumbers = Array.from(
      new Set(rawInstallmentNumbers.map((value) => normalizeInteger(value)).filter((value) => value !== null)),
    );

    targetRows = normalizedRows.filter((row) => selectedInstallmentNumbers.includes(row.installment_number));

    if (!targetRows.length) {
      throw new Error("Selecione ao menos uma parcela válida.");
    }
  } else {
    targetRows = normalizedRows.filter((row) => row.installment_number === currentInstallmentNumber);
  }

  if (!targetRows.length) {
    targetRows = [currentRow];
  }

  const targetInstallmentNumbers = targetRows.map((row) => row.installment_number).sort((left, right) => left - right);

  return {
    scope,
    targetRows,
    targetInstallmentNumbers,
    fullBundleSelected: normalizedRows.length > 0 && targetRows.length === normalizedRows.length,
  };
}

export function shiftInstallmentDate(anchorOccurredOn, currentInstallmentNumber, targetInstallmentNumber) {
  const currentInstallment = normalizeInteger(currentInstallmentNumber);
  const targetInstallment = normalizeInteger(targetInstallmentNumber);

  if (!Number.isInteger(currentInstallment) || !Number.isInteger(targetInstallment)) {
    return normalizeDateOnly(anchorOccurredOn);
  }

  return addMonthsClamped(anchorOccurredOn, targetInstallment - currentInstallment);
}

export function buildInstallmentUpdatePlan({ transaction, bundleRows, nextValues, scope, installmentNumbers }) {
  const selection = resolveInstallmentUpdateSelection(transaction, bundleRows, scope, installmentNumbers);
  const changedFields = buildInstallmentFieldChangeSet(transaction, nextValues);

  return {
    ...selection,
    changedFields,
  };
}
