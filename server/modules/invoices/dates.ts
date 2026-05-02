export type InvoiceStatus = "open" | "closed" | "due_soon" | "overdue";

export interface InvoicePeriod {
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  dueDate: string;
  referenceMonth: string;
  referenceMonthLabel: string;
}

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function normalizeDateOnly(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function parseDateOnly(value: unknown): Date | null {
  const normalized = normalizeDateOnly(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getLastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
}

function clampStatementDay(day: number, year: number, monthIndex: number) {
  return Math.max(1, Math.min(day, getLastDayOfMonth(year, monthIndex)));
}

function getClosingDateForMonth(year: number, monthIndex: number, statementCloseDay: number) {
  const day = clampStatementDay(statementCloseDay, year, monthIndex);
  return toDateOnlyString(new Date(Date.UTC(year, monthIndex, day, 12)));
}

export function addDays(value: string, days: number) {
  const date = parseDateOnly(value);

  if (!date) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnlyString(date);
}

function addMonthsFromYearMonth(year: number, monthIndex: number, months: number) {
  const base = new Date(Date.UTC(year, monthIndex + months, 1, 12));
  return {
    year: base.getUTCFullYear(),
    monthIndex: base.getUTCMonth(),
  };
}

function getDueDateForClosingDate(closingDate: string, statementCloseDay: number, statementDueDay: number) {
  const parsed = parseDateOnly(closingDate);

  if (!parsed) {
    return null;
  }

  const dueMonth =
    statementDueDay > statementCloseDay
      ? {
          year: parsed.getUTCFullYear(),
          monthIndex: parsed.getUTCMonth(),
        }
      : addMonthsFromYearMonth(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1);
  const dueDay = clampStatementDay(statementDueDay, dueMonth.year, dueMonth.monthIndex);
  return toDateOnlyString(new Date(Date.UTC(dueMonth.year, dueMonth.monthIndex, dueDay, 12)));
}

function formatReferenceMonth(closingDate: string) {
  const parsed = parseDateOnly(closingDate);

  if (!parsed) {
    return "";
  }

  const formatted = monthLabelFormatter.format(parsed);
  return formatted.charAt(0).toLocaleUpperCase("pt-BR") + formatted.slice(1);
}

export function resolveInvoicePeriodForTransaction(
  occurredOn: unknown,
  statementCloseDay: number,
  statementDueDay: number,
): InvoicePeriod | null {
  const transactionDate = parseDateOnly(occurredOn);

  if (!transactionDate || !Number.isInteger(statementCloseDay) || !Number.isInteger(statementDueDay)) {
    return null;
  }

  const transactionDateKey = toDateOnlyString(transactionDate);
  const currentMonthClosingDate = getClosingDateForMonth(
    transactionDate.getUTCFullYear(),
    transactionDate.getUTCMonth(),
    statementCloseDay,
  );
  const closingMonth =
    transactionDateKey <= currentMonthClosingDate
      ? {
          year: transactionDate.getUTCFullYear(),
          monthIndex: transactionDate.getUTCMonth(),
        }
      : addMonthsFromYearMonth(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), 1);

  const previousClosingMonth = addMonthsFromYearMonth(closingMonth.year, closingMonth.monthIndex, -1);
  const closingDate = getClosingDateForMonth(closingMonth.year, closingMonth.monthIndex, statementCloseDay);
  const previousClosingDate = getClosingDateForMonth(
    previousClosingMonth.year,
    previousClosingMonth.monthIndex,
    statementCloseDay,
  );
  const periodStart = addDays(previousClosingDate, 1);
  const dueDate = getDueDateForClosingDate(closingDate, statementCloseDay, statementDueDay);

  if (!periodStart || !dueDate) {
    return null;
  }

  return {
    periodStart,
    periodEnd: closingDate,
    closingDate,
    dueDate,
    referenceMonth: closingDate.slice(0, 7),
    referenceMonthLabel: formatReferenceMonth(closingDate),
  };
}

export function resolveInvoiceStatus(input: {
  closingDate: string;
  dueDate: string;
  reminderDays: number;
  today?: unknown;
}): InvoiceStatus {
  const today = normalizeDateOnly(input.today) ?? new Date().toISOString().slice(0, 10);
  const reminderStart = addDays(input.dueDate, -Math.max(1, Math.trunc(input.reminderDays))) ?? input.dueDate;

  if (today > input.dueDate) {
    return "overdue";
  }

  if (today >= reminderStart && today <= input.dueDate) {
    return "due_soon";
  }

  if (today >= input.closingDate) {
    return "closed";
  }

  return "open";
}

export function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
