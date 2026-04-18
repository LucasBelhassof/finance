import { describe, expect, it } from "vitest";

import {
  buildPreviousMonthEndDate,
  buildRecurringProjectionDate,
  buildTransactionRowsWithRecurringProjections,
  shouldSplitRecurringTransaction,
  shouldTruncateRecurringTransaction,
} from "./recurring-income.js";

describe("recurring income helpers", () => {
  it("projects recurring income with the same day across months", () => {
    expect(buildRecurringProjectionDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(buildRecurringProjectionDate("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("caps projections at the recurrence end date", () => {
    const rows = buildTransactionRowsWithRecurringProjections(
      [
        {
          id: 7,
          amount: 5000,
          occurred_on: "2026-01-10",
          is_recurring: true,
          recurrence_ends_on: "2026-03-31",
        },
      ],
      { projectionEndDate: "2026-06-30" },
    );

    expect(rows.map((row) => row.occurred_on)).toEqual(["2026-03-10", "2026-02-10", "2026-01-10"]);
  });

  it("calculates the cutoff as the end of the previous month", () => {
    expect(buildPreviousMonthEndDate("2026-04-10")).toBe("2026-03-31");
  });

  it("splits recurring updates only when the effective date is in the future", () => {
    expect(
      shouldSplitRecurringTransaction({
        existingOccurredOn: "2026-01-10",
        nextOccurredOn: "2026-04-10",
        existingIsRecurring: true,
        nextIsRecurring: true,
        nextAmount: 6000,
      }),
    ).toBe(true);

    expect(
      shouldSplitRecurringTransaction({
        existingOccurredOn: "2026-01-10",
        nextOccurredOn: "2026-01-10",
        existingIsRecurring: true,
        nextIsRecurring: true,
        nextAmount: 6000,
      }),
    ).toBe(false);
  });

  it("truncates recurring deletes only when the removed occurrence is in the future", () => {
    expect(
      shouldTruncateRecurringTransaction({
        existingOccurredOn: "2026-01-10",
        effectiveOccurredOn: "2026-04-10",
        existingIsRecurring: true,
      }),
    ).toBe(true);

    expect(
      shouldTruncateRecurringTransaction({
        existingOccurredOn: "2026-01-10",
        effectiveOccurredOn: "2026-01-10",
        existingIsRecurring: true,
      }),
    ).toBe(false);
  });
});
