export function buildTransactionCategorySyncPlan(transaction, nextCategoryId) {
  const currentCategoryId = Number(transaction?.category_id ?? transaction?.categoryId ?? null);
  const installmentPurchaseId = transaction?.installment_purchase_id ?? transaction?.installmentPurchaseId ?? null;

  if (!installmentPurchaseId || !Number.isInteger(currentCategoryId) || currentCategoryId === Number(nextCategoryId)) {
    return {
      syncInstallmentPurchase: false,
      installmentPurchaseId: null,
    };
  }

  return {
    syncInstallmentPurchase: true,
    installmentPurchaseId,
  };
}
