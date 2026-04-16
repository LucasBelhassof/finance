import { describe, expect, it } from "vitest";

import {
  buildMonthlySpendingSnapshot,
  detectCategoryConcentrationInsight,
  detectInstallmentPressureInsight,
  detectRecurringChargesInsight,
  detectSpendingSpikeInsight,
  generateInsights,
  rankInsights,
} from "./insights-engine.js";

function expense({
  id,
  amount,
  occurredOn,
  description,
  groupSlug = "outros",
  groupLabel = "Outros",
  categorySlug = groupSlug,
  categoryLabel = groupLabel,
  installmentPurchaseId = null,
}) {
  return {
    id,
    amount,
    occurredOn,
    description,
    groupSlug,
    groupLabel,
    categorySlug,
    categoryLabel,
    isInstallment: installmentPurchaseId !== null,
    installmentPurchaseId,
  };
}

describe("insights engine", () => {
  it("returns no insights when there are no transactions", () => {
    expect(generateInsights({ transactions: [], balances: [800] })).toEqual([]);
  });

  it("detects a relevant spending spike", () => {
    const snapshot = buildMonthlySpendingSnapshot({
      balances: [2000],
      transactions: [
        expense({ id: 1, amount: 900, occurredOn: "2026-04-10", description: "Mercado", groupSlug: "alimentacao", groupLabel: "Alimentacao" }),
        expense({ id: 2, amount: 600, occurredOn: "2026-04-15", description: "Restaurante", groupSlug: "alimentacao", groupLabel: "Alimentacao" }),
        expense({ id: 3, amount: 500, occurredOn: "2026-03-10", description: "Mercado", groupSlug: "alimentacao", groupLabel: "Alimentacao" }),
        expense({ id: 4, amount: 400, occurredOn: "2026-03-20", description: "Farmacia", groupSlug: "saude", groupLabel: "Saude" }),
      ],
    });

    const insight = detectSpendingSpikeInsight(snapshot);

    expect(insight).toMatchObject({
      insightType: "spending_spike",
      priority: "high",
    });
    expect(insight?.description).toContain("mes anterior");
  });

  it("detects a dominant category when one bucket concentrates the month", () => {
    const insight = detectCategoryConcentrationInsight(
      buildMonthlySpendingSnapshot({
        balances: [3000],
        transactions: [
          expense({ id: 1, amount: 1000, occurredOn: "2026-04-08", description: "Aluguel", groupSlug: "moradia", groupLabel: "Moradia" }),
          expense({ id: 2, amount: 220, occurredOn: "2026-04-11", description: "Mercado", groupSlug: "alimentacao", groupLabel: "Alimentacao" }),
          expense({ id: 3, amount: 150, occurredOn: "2026-04-18", description: "Uber", groupSlug: "transporte", groupLabel: "Transporte" }),
        ],
      }),
    );

    expect(insight).toMatchObject({
      insightType: "category_concentration",
    });
    expect(insight?.metadata).toMatchObject({
      categoryLabel: "Moradia",
    });
  });

  it("detects recurring charges with monthly cadence", () => {
    const snapshot = buildMonthlySpendingSnapshot({
      balances: [2500],
      transactions: [
        expense({ id: 1, amount: 39.9, occurredOn: "2026-02-05", description: "Spotify Premium", groupSlug: "lazer", groupLabel: "Lazer" }),
        expense({ id: 2, amount: 39.9, occurredOn: "2026-03-05", description: "Spotify Premium", groupSlug: "lazer", groupLabel: "Lazer" }),
        expense({ id: 3, amount: 39.9, occurredOn: "2026-04-05", description: "Spotify Premium", groupSlug: "lazer", groupLabel: "Lazer" }),
      ],
    });

    const insight = detectRecurringChargesInsight(snapshot);

    expect(insight).toMatchObject({
      insightType: "recurring_charges",
    });
    expect(insight?.metadata).toMatchObject({
      recurringCount: 1,
    });
  });

  it("detects installment pressure when installments dominate the month", () => {
    const snapshot = buildMonthlySpendingSnapshot({
      balances: [2200],
      transactions: [
        expense({
          id: 1,
          amount: 320,
          occurredOn: "2026-04-03",
          description: "Notebook 1/8",
          groupSlug: "tecnologia",
          groupLabel: "Tecnologia",
          installmentPurchaseId: 88,
        }),
        expense({
          id: 2,
          amount: 280,
          occurredOn: "2026-04-06",
          description: "Celular 2/10",
          groupSlug: "tecnologia",
          groupLabel: "Tecnologia",
          installmentPurchaseId: 99,
        }),
        expense({ id: 3, amount: 180, occurredOn: "2026-04-10", description: "Mercado", groupSlug: "alimentacao", groupLabel: "Alimentacao" }),
      ],
    });

    const insight = detectInstallmentPressureInsight(snapshot);

    expect(insight).toMatchObject({
      insightType: "installment_pressure",
      priority: "high",
    });
  });

  it("orders insights by priority and semantic weight", () => {
    const ranked = rankInsights(
      [
        { id: "low", title: "Low", priority: "low", insightType: "top_category" },
        { id: "high", title: "High", priority: "high", insightType: "low_balance_risk" },
        { id: "medium", title: "Medium", priority: "medium", insightType: "recurring_charges" },
      ],
      3,
    );

    expect(ranked.map((item) => item.id)).toEqual(["high", "medium", "low"]);
  });

  it("avoids semantic duplicates when concentration already covers the top category", () => {
    const insights = generateInsights(
      {
        balances: [900],
        transactions: [
          expense({ id: 1, amount: 1100, occurredOn: "2026-04-05", description: "Aluguel", groupSlug: "moradia", groupLabel: "Moradia" }),
          expense({ id: 2, amount: 160, occurredOn: "2026-04-09", description: "Uber", groupSlug: "transporte", groupLabel: "Transporte" }),
          expense({ id: 3, amount: 120, occurredOn: "2026-04-14", description: "Mercado", groupSlug: "alimentacao", groupLabel: "Alimentacao" }),
        ],
      },
      { limit: 6 },
    );

    const categoryInsights = insights.filter(
      (item) => item.insightType === "category_concentration" || item.insightType === "top_category",
    );

    expect(categoryInsights).toHaveLength(1);
    expect(categoryInsights[0]?.insightType).toBe("category_concentration");
  });
});
