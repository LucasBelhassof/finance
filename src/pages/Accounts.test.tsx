import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountsPage from "@/pages/Accounts";

const mockCreateBank = vi.fn();
const mockUpdateBank = vi.fn();

vi.mock("@/hooks/use-banks", () => ({
  useBanks: () => ({
    data: [
      {
        id: 1,
        slug: "conta-principal",
        name: "Conta Principal",
        accountType: "bank_account",
        parentBankConnectionId: null,
        parentAccountName: null,
        statementCloseDay: null,
        statementDueDay: null,
        notifyInvoiceClosed: false,
        notifyInvoiceDueSoon: false,
        invoiceDueReminderDays: 3,
        connected: true,
        color: "bg-blue-500",
        currentBalance: 1000,
        formattedBalance: "R$ 1.000,00",
        creditLimit: null,
        formattedCreditLimit: null,
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateBankConnection: () => ({
    mutateAsync: mockCreateBank,
    isPending: false,
  }),
  useUpdateBankConnection: () => ({
    mutateAsync: mockUpdateBank,
    isPending: false,
  }),
  useDeleteBankConnection: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/color-field", () => ({
  ColorField: ({ value }: { value: string }) => <span>{value}</span>,
}));

describe("AccountsPage invoice preferences", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    mockCreateBank.mockReset();
    mockUpdateBank.mockReset();
  });

  it("keeps invoice preference fields in the bank creation payload", async () => {
    mockCreateBank.mockResolvedValue({});

    render(<AccountsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    fireEvent.change(screen.getByPlaceholderText("Nome da conta ou cartão"), {
      target: { value: "Nubank" },
    });
    fireEvent.change(screen.getByPlaceholderText("Limite total do cartão"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Conta Principal" }));
    fireEvent.change(screen.getByPlaceholderText("Dia de fechamento"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Dia de vencimento"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("switch", { name: /notificar vencimento próximo/i }));
    fireEvent.change(screen.getByPlaceholderText("Dias antes do vencimento"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockCreateBank).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Nubank",
          accountType: "credit_card",
          parentBankConnectionId: "1",
          statementCloseDay: 10,
          statementDueDay: 20,
          notifyInvoiceClosed: false,
          notifyInvoiceDueSoon: true,
          invoiceDueReminderDays: 5,
        }),
      );
    });
  });
});
