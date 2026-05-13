import { describe, expect, it } from "vitest";

import {
  buildInstallmentFieldChangeSet,
  buildInstallmentUpdatePlan,
  buildTransactionCategorySyncPlan,
  resolveInstallmentUpdateSelection,
  shiftInstallmentDate,
} from "./transaction-update.js";

const bundleRows = [
  { id: 201, installment_number: 1, occurred_on: "2026-01-31", amount: -120, category_id: 4, bank_connection_id: 2 },
  { id: 202, installment_number: 2, occurred_on: "2026-02-28", amount: -120, category_id: 4, bank_connection_id: 2 },
  { id: 203, installment_number: 3, occurred_on: "2026-03-31", amount: -120, category_id: 4, bank_connection_id: 2 },
  { id: 204, installment_number: 4, occurred_on: "2026-04-30", amount: -120, category_id: 4, bank_connection_id: 2 },
];

const currentTransaction = {
  id: 202,
  description: "Notebook",
  amount: -120,
  occurred_on: "2026-02-28",
  bank_connection_id: 2,
  category_id: 4,
  installment_purchase_id: 91,
  installment_number: 2,
};

describe("buildTransactionCategorySyncPlan", () => {
  it("syncs category changes across the installment purchase", () => {
    expect(
      buildTransactionCategorySyncPlan(
        {
          category_id: 4,
          installment_purchase_id: 91,
        },
        8,
      ),
    ).toEqual({
      syncInstallmentPurchase: true,
      installmentPurchaseId: 91,
    });
  });

  it("keeps single updates isolated for non-installment transactions", () => {
    expect(
      buildTransactionCategorySyncPlan(
        {
          category_id: 4,
          installment_purchase_id: null,
        },
        8,
      ),
    ).toEqual({
      syncInstallmentPurchase: false,
      installmentPurchaseId: null,
    });
  });

  it("does not sync when the category did not change", () => {
    expect(
      buildTransactionCategorySyncPlan(
        {
          category_id: 4,
          installment_purchase_id: 91,
        },
        4,
      ),
    ).toEqual({
      syncInstallmentPurchase: false,
      installmentPurchaseId: null,
    });
  });
});

describe("resolveInstallmentUpdateSelection", () => {
  it("keeps the update on the current installment by default", () => {
    expect(resolveInstallmentUpdateSelection(currentTransaction, bundleRows, undefined)).toMatchObject({
      scope: "current",
      targetInstallmentNumbers: [2],
      fullBundleSelected: false,
    });
  });

  it("selects the full purchase for all scope", () => {
    expect(resolveInstallmentUpdateSelection(currentTransaction, bundleRows, "all").targetInstallmentNumbers).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("selects the current installment and later rows for future scope", () => {
    expect(
      resolveInstallmentUpdateSelection(currentTransaction, bundleRows, "future").targetInstallmentNumbers,
    ).toEqual([2, 3, 4]);
  });

  it("selects the current installment and previous rows for past scope", () => {
    expect(resolveInstallmentUpdateSelection(currentTransaction, bundleRows, "past").targetInstallmentNumbers).toEqual([
      1, 2,
    ]);
  });

  it("uses the chosen installments for custom scope", () => {
    expect(
      resolveInstallmentUpdateSelection(currentTransaction, bundleRows, "custom", [1, 4]).targetInstallmentNumbers,
    ).toEqual([1, 4]);
  });

  it("rejects custom scope without valid installment numbers", () => {
    expect(() => resolveInstallmentUpdateSelection(currentTransaction, bundleRows, "custom", [])).toThrow(
      "Selecione ao menos uma parcela válida.",
    );
  });
});

describe("buildInstallmentFieldChangeSet", () => {
  it("detects only the fields that changed", () => {
    expect(
      buildInstallmentFieldChangeSet(currentTransaction, {
        description: "Notebook gamer",
        amount: -120,
        occurredOn: "2026-02-28",
        bankConnectionId: 2,
        categoryId: 8,
      }),
    ).toEqual({
      description: true,
      amount: false,
      occurredOn: false,
      bankConnectionId: false,
      categoryId: true,
      hasChanges: true,
    });
  });
});

describe("buildInstallmentUpdatePlan", () => {
  it("combines the target selection and changed fields", () => {
    expect(
      buildInstallmentUpdatePlan({
        transaction: currentTransaction,
        bundleRows,
        nextValues: {
          description: "Notebook premium",
          amount: -150,
          occurredOn: "2026-02-20",
          bankConnectionId: 3,
          categoryId: 7,
        },
        scope: "future",
      }),
    ).toMatchObject({
      targetInstallmentNumbers: [2, 3, 4],
      changedFields: {
        description: true,
        amount: true,
        occurredOn: true,
        bankConnectionId: true,
        categoryId: true,
        hasChanges: true,
      },
    });
  });
});

describe("shiftInstallmentDate", () => {
  it("keeps the monthly installment cadence with day clamping", () => {
    expect(shiftInstallmentDate("2026-02-28", 2, 3)).toBe("2026-03-28");
    expect(shiftInstallmentDate("2026-01-31", 1, 2)).toBe("2026-02-28");
    expect(shiftInstallmentDate("2026-01-31", 1, 4)).toBe("2026-04-30");
  });
});
