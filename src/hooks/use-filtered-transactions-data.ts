import { useMemo } from "react";

import { isDateInRange } from "@/lib/transactions-date-filter";
import type { CategoryItem, TransactionItem } from "@/types/api";

export type TransactionsTypeFilter = "all" | "income" | "expense";

export type TransactionsDerivedFilters = {
  categoryFilter: string;
  range: {
    startDate: string;
    endDate: string;
  };
  search: string;
  typeFilter: TransactionsTypeFilter;
};

export type CategoryBreakdownItem = {
  id: string;
  label: string;
  color: string;
  count: number;
  total: number;
  formattedTotal: string;
  percentage: number;
};

function resolveBreakdownTransactionType(categories: CategoryItem[], filters: TransactionsDerivedFilters): "income" | "expense" {
  if (filters.typeFilter === "income") {
    return "income";
  }

  if (filters.typeFilter === "expense") {
    return "expense";
  }

  if (filters.categoryFilter !== "all") {
    const matchedCategory = categories.find((category) => {
      const categoryKey = resolveCategoryKey(category);
      const categoryLabel = resolveCategoryLabel(category);

      return (
        categoryKey === filters.categoryFilter ||
        categoryLabel === filters.categoryFilter ||
        String(category.groupLabel ?? "") === filters.categoryFilter
      );
    });

    if (matchedCategory?.transactionType === "income") {
      return "income";
    }
  }

  return "expense";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveCategoryLabel(category: Partial<CategoryItem> | Partial<TransactionItem["category"]>) {
  return String(category.groupLabel ?? category.label ?? "");
}

function resolveCategoryKey(category: Partial<CategoryItem> | Partial<TransactionItem["category"]>) {
  return String(category.id ?? category.groupSlug ?? category.slug ?? resolveCategoryLabel(category) ?? "category");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getFilteredTransactionsData(
  transactions: TransactionItem[],
  categories: CategoryItem[],
  filters: TransactionsDerivedFilters,
) {
  const normalizedSearch = normalizeText(filters.search);
  const breakdownTransactionType = resolveBreakdownTransactionType(categories, filters);

  const contextualTransactions = transactions.filter((transaction) => {
    const matchesDate = isDateInRange(transaction.occurredOn, filters.range);
    const matchesType =
      filters.typeFilter === "all" ||
      (filters.typeFilter === "income" ? transaction.amount > 0 : transaction.amount < 0);
    const matchesSearch =
      !normalizedSearch ||
      normalizeText(transaction.description).includes(normalizedSearch) ||
      normalizeText(transaction.category.groupLabel).includes(normalizedSearch) ||
      normalizeText(resolveCategoryLabel(transaction.category)).includes(normalizedSearch);

    return matchesDate && matchesType && matchesSearch;
  });

  const filteredTransactions = contextualTransactions.filter((transaction) => {
    const matchesCategory =
      filters.categoryFilter === "all" ||
      resolveCategoryKey(transaction.category) === filters.categoryFilter ||
      resolveCategoryLabel(transaction.category) === filters.categoryFilter ||
      String(transaction.category.groupLabel ?? "") === filters.categoryFilter;

    return matchesCategory;
  });

  const totalIncomes = filteredTransactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const groupedMap = new Map<string, { id: string; label: string; color: string; count: number; total: number }>();

  contextualTransactions
    .filter((transaction) => (breakdownTransactionType === "income" ? transaction.amount > 0 : transaction.amount < 0))
    .forEach((transaction) => {
      const categoryKey = resolveCategoryKey(transaction.category);
      const current = groupedMap.get(categoryKey);
      const transactionTotal = Math.abs(transaction.amount);

      if (current) {
        current.count += 1;
        current.total += transactionTotal;
      } else {
        groupedMap.set(categoryKey, {
          id: categoryKey,
          label: resolveCategoryLabel(transaction.category),
          color: transaction.category.groupColor,
          count: 1,
          total: transactionTotal,
        });
      }
    });

  const totalGroupedAmount = Array.from(groupedMap.values()).reduce((sum, item) => sum + item.total, 0);
  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(groupedMap.values())
    .map((item) => ({
      ...item,
      formattedTotal: formatCurrency(item.total),
      percentage: totalGroupedAmount > 0 ? Math.round((item.total / totalGroupedAmount) * 100) : 0,
    }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, "pt-BR"));

  return {
    filteredTransactions,
    summaryCardsData: {
      totalIncomes,
      totalExpenses,
      balance: totalIncomes - totalExpenses,
    },
    breakdownTransactionType,
    categoryBreakdown,
    categoryCounts: categoryBreakdown.map(({ id, label, color, count }) => ({ id, label, color, count })),
  };
}

export function useFilteredTransactionsData(
  transactions: TransactionItem[],
  categories: CategoryItem[],
  filters: TransactionsDerivedFilters,
) {
  return useMemo(
    () => getFilteredTransactionsData(transactions, categories, filters),
    [categories, filters.categoryFilter, filters.range.endDate, filters.range.startDate, filters.search, filters.typeFilter, transactions],
  );
}
