import { describe, expect, it } from "vitest";

import { resolveDayPeriodGreeting } from "@/lib/greeting";

describe("resolveDayPeriodGreeting", () => {
  it("returns Bom dia during AM hours", () => {
    expect(resolveDayPeriodGreeting(new Date("2026-04-24T09:00:00"))).toBe("Bom dia");
    expect(resolveDayPeriodGreeting(new Date("2026-04-24T11:59:00"))).toBe("Bom dia");
  });

  it("returns Boa noite during PM hours", () => {
    expect(resolveDayPeriodGreeting(new Date("2026-04-24T12:00:00"))).toBe("Boa noite");
    expect(resolveDayPeriodGreeting(new Date("2026-04-24T23:59:00"))).toBe("Boa noite");
  });
});
