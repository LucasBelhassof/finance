import { describe, expect, it } from "vitest";

import { buildTransactionCategorySyncPlan } from "./transaction-update.js";

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
