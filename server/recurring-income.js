function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function parseDateOnly(value) {
  return new Date(`${normalizeDateValue(value)}T12:00:00Z`);
}

function clampDayToMonth(year, monthIndex, day) {
  return Math.min(day, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate());
}

export function buildRecurringProjectionDate(value, monthOffset) {
  const baseDate = parseDateOnly(value);
  const targetDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + monthOffset, 1));
  targetDate.setUTCDate(clampDayToMonth(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), baseDate.getUTCDate()));
  return targetDate.toISOString().slice(0, 10);
}

export function buildPreviousMonthEndDate(value) {
  const currentDate = parseDateOnly(value);
  return new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 0)).toISOString().slice(0, 10);
}

function sortTransactionRowsDesc(left, right) {
  const dateDiff = new Date(right.occurred_on).getTime() - new Date(left.occurred_on).getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
}

export function buildTransactionRowsWithRecurringProjections(rows, { projectionEndDate, projectionLimit = null } = {}) {
  const normalizedProjectionEndDate = normalizeDateValue(projectionEndDate);

  if (!normalizedProjectionEndDate) {
    return [...rows].sort(sortTransactionRowsDesc);
  }

  const expandedRows = [...rows];

  rows.forEach((row) => {
    if (!row.is_recurring || Number(row.amount) <= 0) {
      return;
    }

    const baseDate = parseDateOnly(row.occurred_on);
    const projectionEnd = parseDateOnly(normalizedProjectionEndDate);
    const recurrenceEndOn = normalizeDateValue(row.recurrence_ends_on);
    const cappedProjectionEndDate =
      recurrenceEndOn && recurrenceEndOn < normalizedProjectionEndDate ? recurrenceEndOn : normalizedProjectionEndDate;
    const cappedProjectionEnd = parseDateOnly(cappedProjectionEndDate);
    const monthDiff =
      (cappedProjectionEnd.getUTCFullYear() - baseDate.getUTCFullYear()) * 12 +
      (cappedProjectionEnd.getUTCMonth() - baseDate.getUTCMonth());

    if (cappedProjectionEndDate < normalizeDateValue(row.occurred_on) || projectionEnd < baseDate) {
      return;
    }

    for (let monthOffset = 1; monthOffset <= monthDiff; monthOffset += 1) {
      const projectedOccurredOn = buildRecurringProjectionDate(row.occurred_on, monthOffset);

      if (projectedOccurredOn > cappedProjectionEndDate) {
        continue;
      }

      expandedRows.push({
        ...row,
        id: `recurring:${row.id}:${projectedOccurredOn}`,
        occurred_on: projectedOccurredOn,
        is_recurring_projection: true,
        recurring_source_transaction_id: row.id,
      });
    }
  });

  expandedRows.sort(sortTransactionRowsDesc);

  if (Number.isInteger(projectionLimit) && projectionLimit > 0) {
    return expandedRows.slice(0, projectionLimit);
  }

  return expandedRows;
}

export function shouldSplitRecurringTransaction({ existingOccurredOn, nextOccurredOn, existingIsRecurring, nextIsRecurring, nextAmount }) {
  if (!existingIsRecurring) {
    return false;
  }

  const normalizedExistingOccurredOn = normalizeDateValue(existingOccurredOn);
  const normalizedNextOccurredOn = normalizeDateValue(nextOccurredOn);

  if (!normalizedExistingOccurredOn || !normalizedNextOccurredOn) {
    return false;
  }

  return normalizedNextOccurredOn > normalizedExistingOccurredOn && (nextIsRecurring || Number(nextAmount) > 0);
}

export function shouldTruncateRecurringTransaction({ existingOccurredOn, effectiveOccurredOn, existingIsRecurring }) {
  if (!existingIsRecurring) {
    return false;
  }

  const normalizedExistingOccurredOn = normalizeDateValue(existingOccurredOn);
  const normalizedEffectiveOccurredOn = normalizeDateValue(effectiveOccurredOn);

  if (!normalizedExistingOccurredOn || !normalizedEffectiveOccurredOn) {
    return false;
  }

  return normalizedEffectiveOccurredOn > normalizedExistingOccurredOn;
}
