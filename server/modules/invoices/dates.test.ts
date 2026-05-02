import { describe, expect, it } from "vitest";

import { resolveInvoicePeriodForTransaction, resolveInvoiceStatus } from "./dates.js";

describe("invoice date helpers", () => {
  it("assigns transactions to the next invoice when they happen after closing day", () => {
    const period = resolveInvoicePeriodForTransaction("2026-04-11", 10, 20);

    expect(period).toMatchObject({
      periodStart: "2026-04-11",
      periodEnd: "2026-05-10",
      closingDate: "2026-05-10",
      dueDate: "2026-05-20",
      referenceMonth: "2026-05",
    });
  });

  it("uses same-month due dates only when due day is after close day", () => {
    expect(resolveInvoicePeriodForTransaction("2026-04-10", 10, 20)?.dueDate).toBe("2026-04-20");
    expect(resolveInvoicePeriodForTransaction("2026-04-10", 10, 5)?.dueDate).toBe("2026-05-05");
  });

  it("clamps statement days for February and 31-day month boundaries", () => {
    const february = resolveInvoicePeriodForTransaction("2026-02-28", 31, 31);
    const april = resolveInvoicePeriodForTransaction("2026-04-30", 31, 5);

    expect(february).toMatchObject({
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      closingDate: "2026-02-28",
      dueDate: "2026-03-31",
    });
    expect(april).toMatchObject({
      periodEnd: "2026-04-30",
      dueDate: "2026-05-05",
    });
  });

  it("calculates open, closed, due soon and overdue statuses", () => {
    const base = {
      closingDate: "2026-04-10",
      dueDate: "2026-04-20",
      reminderDays: 3,
    };

    expect(resolveInvoiceStatus({ ...base, today: "2026-04-09" })).toBe("open");
    expect(resolveInvoiceStatus({ ...base, today: "2026-04-11" })).toBe("closed");
    expect(resolveInvoiceStatus({ ...base, today: "2026-04-18" })).toBe("due_soon");
    expect(resolveInvoiceStatus({ ...base, today: "2026-04-21" })).toBe("overdue");
  });
});
