function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseDateOnly(value) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
}

function normalizeDateInput(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

export function shiftDashboardDateKey(value, amountInDays) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + amountInDays);
  return formatDateOnly(date);
}

export function normalizeDashboardFilters(filters = {}, now = new Date()) {
  const today = formatDateOnly(now);
  const normalizedStartDate = normalizeDateInput(filters.startDate);
  const normalizedEndDate = normalizeDateInput(filters.endDate);

  if (!normalizedStartDate && !normalizedEndDate) {
    return {
      active: false,
      startDate: null,
      endDate: null,
      previousStartDate: null,
      previousEndDate: null,
      referenceDate: today,
    };
  }

  let startDate = normalizedStartDate ?? normalizedEndDate ?? today;
  let endDate = normalizedEndDate ?? normalizedStartDate ?? today;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const totalDays = Math.round((parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) / 86400000) + 1;
  const previousEndDate = shiftDashboardDateKey(startDate, -1);
  const previousStartDate = shiftDashboardDateKey(previousEndDate, -(totalDays - 1));

  return {
    active: true,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    referenceDate: endDate,
  };
}
