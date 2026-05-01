import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import type { ImportPreviewData } from "@/types/api";

const previewMutateAsync = vi.fn();
const commitMutateAsync = vi.fn();

vi.mock("@/hooks/use-transactions", () => ({
  useUniversalImportPreview: () => ({
    mutateAsync: previewMutateAsync,
    isPending: false,
  }),
  useCommitTransactionImport: () => ({
    mutateAsync: commitMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/components/transactions/ImportPreviewTable", () => ({
  default: () => <div data-testid="import-preview-table">preview table</div>,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const previewData: ImportPreviewData = {
  previewToken: "preview-1",
  expiresAt: "2026-04-06T21:32:00.000Z",
  importSource: "bank_statement",
  detectedFileType: "csv",
  detectedSourceKind: "bank_statement",
  sourceKindConfidence: 0.88,
  selectedBankConnectionId: 2,
  warnings: [],
  bankConnectionId: 2,
  bankConnectionName: "Caixa/Dinheiro",
  fileMetadata: {
    originalFilename: "extrato.csv",
    issuerName: null,
    statementDueDate: null,
    statementReferenceMonth: null,
  },
  fileSummary: {
    totalRows: 1,
    importableRows: 1,
    errorRows: 0,
    duplicateRows: 0,
    actionRequiredRows: 0,
  },
  items: [
    {
      rowIndex: 15,
      description: "Despesa sem categoria",
      normalizedDescription: "despesa sem categoria",
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
      importSource: "bank_statement",
      sourceKind: "bank_statement",
      bankConnectionId: 2,
      bankConnectionName: "Caixa/Dinheiro",
      suggestedCategoryId: null,
      suggestedCategoryLabel: null,
      suggestionSource: null,
      matchedRuleId: null,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: null,
      aiReason: null,
      aiStatus: "idle",
      possibleDuplicate: false,
      duplicateReason: "",
      canImport: true,
      requiresCategorySelection: false,
      requiresUserAction: false,
      defaultExclude: false,
      warnings: [],
      errors: [],
      issues: [],
      confidence: 0.9,
    },
  ],
};

describe("ImportTransactionsModal", () => {
  beforeEach(() => {
    previewMutateAsync.mockReset();
    commitMutateAsync.mockReset();
    previewMutateAsync.mockResolvedValue(previewData);
    commitMutateAsync.mockResolvedValue({
      importedCount: 1,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    });
  });

  it("uploads without requiring importSource first", async () => {
    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[]}
        banks={[
          {
            id: 2,
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
        ]}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /gerar previa/i }));

    await waitFor(() => {
      expect(screen.getByTestId("import-preview-table")).toBeInTheDocument();
    });

    expect(previewMutateAsync).toHaveBeenCalledWith({
      file: expect.any(File),
      bankConnectionId: undefined,
      filePassword: "",
    });
  });

  it("sends the global bank selection on preview and commit", async () => {
    render(
      <ImportTransactionsModal
        open
        onOpenChange={vi.fn()}
        categories={[]}
        banks={[
          {
            id: 2,
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
        ]}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("Itau"));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["descricao,valor"], "extrato.csv", { type: "text/csv" })],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /gerar previa/i }));

    await waitFor(() => expect(screen.getByTestId("import-preview-table")).toBeInTheDocument());

    expect(previewMutateAsync).toHaveBeenCalledWith({
      file: expect.any(File),
      bankConnectionId: "2",
      filePassword: "",
    });

    fireEvent.click(screen.getByRole("button", { name: /confirmar importacao/i }));

    await waitFor(() =>
      expect(commitMutateAsync).toHaveBeenCalledWith({
        previewToken: "preview-1",
        bankConnectionId: "2",
        items: expect.any(Array),
      }),
    );
  });
}
