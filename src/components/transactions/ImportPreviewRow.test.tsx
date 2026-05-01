import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImportPreviewRow from "@/components/transactions/ImportPreviewRow";
import { Table, TableBody } from "@/components/ui/table";
import type { BankItem, CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

const banks: BankItem[] = [
  {
    id: 1,
    slug: "itau",
    name: "Itau",
    accountType: "bank_account",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    connected: true,
    color: "bg-orange-500",
    currentBalance: 0,
    formattedBalance: "R$ 0,00",
  },
];

const categories: CategoryItem[] = [
  {
    id: 2,
    slug: "outros-despesas",
    label: "Outros",
    transactionType: "expense",
    iconName: "Wallet",
    icon: (() => null) as never,
    color: "text-muted-foreground",
    groupSlug: "outros",
    groupLabel: "Outros",
    groupColor: "bg-muted-foreground",
  },
];

const draft: ImportCommitItem = {
  rowIndex: 1,
  description: "Transferencia recebida",
  amount: "396.00",
  occurredOn: "2026-03-28",
  type: "expense",
  categoryId: "",
  bankConnectionId: "",
  sourceKind: "bank_statement",
  exclude: false,
  ignoreDuplicate: false,
};

const item: ImportPreviewItem = {
  rowIndex: 1,
  description: "Transferencia recebida",
  normalizedDescription: "transferencia recebida",
  purchaseDescriptionBase: null,
  normalizedPurchaseDescriptionBase: null,
  amount: "396.00",
  normalizedAmount: "396.00",
  occurredOn: "2026-03-28",
  normalizedOccurredOn: "2026-03-28",
  purchaseOccurredOn: null,
  isInstallment: false,
  installmentIndex: null,
  installmentCount: null,
  generatedInstallmentCount: null,
  type: "expense",
  suggestedCategoryId: null,
  suggestedCategoryLabel: null,
  suggestionSource: null,
  importSource: "bank_statement",
  sourceKind: "bank_statement",
  bankConnectionId: "",
  bankConnectionName: "Conta a definir",
  matchedRuleId: null,
  aiSuggestedType: null,
  aiSuggestedCategoryId: null,
  aiSuggestedCategoryLabel: null,
  aiConfidence: null,
  aiReason: null,
  aiStatus: "idle",
  possibleDuplicate: true,
  duplicateReason: "Ja existe uma transacao importada com os mesmos dados.",
  canImport: false,
  requiresCategorySelection: false,
  requiresUserAction: true,
  defaultExclude: false,
  warnings: [],
  errors: [],
  issues: [{ level: "warning", message: "Revise esta linha." }],
  confidence: 0.4,
};

describe("ImportPreviewRow", () => {
  it("shows duplicate and issue indicators", () => {
    render(
      <Table>
        <TableBody>
          <ImportPreviewRow banks={banks} draft={draft} item={item} categories={categories} onChange={vi.fn()} previewToken="preview-1" />
        </TableBody>
      </Table>,
    );

    expect(screen.getByText(/ja existe uma transacao importada/i)).toBeInTheDocument();
    expect(screen.getByText(/revise esta linha/i)).toBeInTheDocument();
  });

  it("emits source kind changes", async () => {
    const onChange = vi.fn();

    render(
      <Table>
        <TableBody>
          <ImportPreviewRow banks={banks} draft={draft} item={item} categories={categories} onChange={onChange} previewToken="preview-1" />
        </TableBody>
      </Table>,
    );

    const selects = screen.getAllByRole("combobox");
    fireEvent.mouseDown(selects[3]);
    fireEvent.click(await screen.findByText("Fatura"));

    expect(onChange).toHaveBeenCalledWith("preview-1", 1, {
      sourceKind: "credit_card_statement",
      bankConnectionId: "",
    });
  });
}
