import { describe, expect, it } from "vitest";

import { normalizeDashboardFilters, shiftDashboardDateKey } from "./dashboard-filters.js";

describe("shiftDashboardDateKey", () => {
  it("shifts date keys preserving yyyy-mm-dd format", () => {
    expect(shiftDashboardDateKey("2026-04-10", 5)).toBe("2026-04-15");
    expect(shiftDashboardDateKey("2026-04-10", -10)).toBe("2026-03-31");
  });
});

describe("normalizeDashboardFilters", () => {
  it("returns inactive filters when no period is provided", () => {
    expect(normalizeDashboardFilters({}, new Date("2026-04-23T12:00:00Z"))).toEqual({
      active: false,
      startDate: null,
      endDate: null,
      previousStartDate: null,
      previousEndDate: null,
      referenceDate: "2026-04-23",
    });
  });

  it("normalizes an explicit range and derives the previous comparison window", () => {
    expect(
      normalizeDashboardFilters(
        {
          startDate: "2026-04-10",
          endDate: "2026-04-20",
        },
        new Date("2026-04-23T12:00:00Z"),
      ),
    ).toEqual({
      active: true,
      startDate: "2026-04-10",
      endDate: "2026-04-20",
      previousStartDate: "2026-03-30",
      previousEndDate: "2026-04-09",
      referenceDate: "2026-04-20",
    });
  });

  it("accepts a single provided boundary and uses it as a one-day range", () => {
    expect(
      normalizeDashboardFilters(
        {
          endDate: "2026-04-15",
        },
        new Date("2026-04-23T12:00:00Z"),
      ),
    ).toEqual({
      active: true,
      startDate: "2026-04-15",
      endDate: "2026-04-15",
      previousStartDate: "2026-04-14",
      previousEndDate: "2026-04-14",
      referenceDate: "2026-04-15",
    });
  });
});
