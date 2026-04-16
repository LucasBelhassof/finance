import { describe, expect, it } from "vitest";

import { getFilteredTransactionsData } from "@/hooks/use-filtered-transactions-data";

const categories = [
  { id: 1, label: "Restaurantes", groupLabel: "Alimentacao", groupColor: "bg-warning", transactionType: "expense" },
  { id: 2, label: "Transporte", groupLabel: "Transporte", groupColor: "bg-info", transactionType: "expense" },
  { id: 3, label: "Salario", groupLabel: "Receitas", groupColor: "bg-income", transactionType: "income" },
];

const transactions = [
  {
    id: 1,
    description: "iFood",
    amount: -67.9,
    occurredOn: "2026-04-06",
    category: { label: "Restaurantes", groupLabel: "Alimentacao", groupColor: "bg-warning" },
  },
  {
    id: 2,
    description: "Uber",
    amount: -23.5,
    occurredOn: "2026-04-05",
    category: { label: "Transporte", groupLabel: "Transporte", groupColor: "bg-info" },
  },
  {
    id: 3,
    description: "Salario",
    amount: 6500,
    occurredOn: "2026-03-20",
    category: { label: "Salario", groupLabel: "Receitas", groupColor: "bg-income" },
  },
];

describe("getFilteredTransactionsData", () => {
  it("derives list, cards and category counts from the same subset", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "",
      typeFilter: "expense",
      categoryFilter: "all",
      range: {
        startDate: "2026-04-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(2);
    expect(result.summaryCardsData.totalIncomes).toBe(0);
    expect(result.summaryCardsData.totalExpenses).toBe(91.4);
    expect(result.breakdownTransactionType).toBe("expense");
    expect(result.categoryBreakdown.find((item) => item.label === "Alimentacao")?.count).toBe(1);
    expect(result.categoryBreakdown.find((item) => item.label === "Alimentacao")?.total).toBe(67.9);
    expect(result.categoryBreakdown.find((item) => item.label === "Transporte")?.count).toBe(1);
  });

  it("applies search and category after period filtering while keeping the category breakdown contextual", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "uber",
      typeFilter: "all",
      categoryFilter: "Transporte",
      range: {
        startDate: "2026-04-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(1);
    expect(result.filteredTransactions[0].description).toBe("Uber");
    expect(result.categoryBreakdown).toHaveLength(1);
    expect(result.categoryBreakdown[0]).toMatchObject({
      label: "Transporte",
      count: 1,
      total: 23.5,
      percentage: 100,
    });
    expect(result.breakdownTransactionType).toBe("expense");
  });

  it("keeps the category breakdown independent from the active category filter", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "",
      typeFilter: "expense",
      categoryFilter: "Transporte",
      range: {
        startDate: "2026-04-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(1);
    expect(result.filteredTransactions[0].description).toBe("Uber");
    expect(result.categoryBreakdown.map((item) => item.label)).toEqual(["Alimentacao", "Transporte"]);
    expect(result.breakdownTransactionType).toBe("expense");
  });

  it("keeps the category chart on expenses by default even when the contextual list has incomes", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "",
      typeFilter: "all",
      categoryFilter: "all",
      range: {
        startDate: "2026-03-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(3);
    expect(result.breakdownTransactionType).toBe("expense");
    expect(result.categoryBreakdown.map((item) => item.label)).toEqual(["Alimentacao", "Transporte"]);
  });

  it("shows income categories when the selected category is an income category", () => {
    const result = getFilteredTransactionsData(transactions as never[], categories as never[], {
      search: "",
      typeFilter: "all",
      categoryFilter: "3",
      range: {
        startDate: "2026-03-01",
        endDate: "2026-04-06",
      },
    });

    expect(result.filteredTransactions).toHaveLength(1);
    expect(result.filteredTransactions[0].description).toBe("Salario");
    expect(result.breakdownTransactionType).toBe("income");
    expect(result.categoryBreakdown).toEqual([
      expect.objectContaining({
        label: "Receitas",
        total: 6500,
        percentage: 100,
      }),
    ]);
  });
});
