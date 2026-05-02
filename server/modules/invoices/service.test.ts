import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildInvoicesResponse, generateInvoiceNotificationsForUser } from "./service.js";

const { connectMock, createSystemNotificationForUserMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  createSystemNotificationForUserMock: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  db: {
    connect: connectMock,
    query: vi.fn(),
  },
}));

vi.mock("../notifications/service.js", () => ({
  createSystemNotificationForUser: createSystemNotificationForUserMock,
}));

const cards = [
  {
    id: 2,
    slug: "nubank",
    name: "Nubank",
    color: "bg-violet-500",
    statementCloseDay: 10,
    statementDueDay: 20,
    notifyInvoiceClosed: true,
    notifyInvoiceDueSoon: false,
    invoiceDueReminderDays: 3,
  },
  {
    id: 3,
    slug: "visa",
    name: "Visa",
    color: "bg-blue-500",
    statementCloseDay: 25,
    statementDueDay: 5,
    notifyInvoiceClosed: false,
    notifyInvoiceDueSoon: true,
    invoiceDueReminderDays: 5,
  },
];

const rows = [
  {
    transactionId: 101,
    description: "Mercado",
    amount: -120,
    occurredOn: "2026-04-09",
    isRecurring: false,
    housingId: null,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    cardId: 2,
    cardSlug: "nubank",
    cardName: "Nubank",
    cardColor: "bg-violet-500",
    statementCloseDay: 10,
    statementDueDay: 20,
    notifyInvoiceClosed: true,
    notifyInvoiceDueSoon: false,
    invoiceDueReminderDays: 3,
    categoryId: 7,
    categorySlug: "mercado",
    categoryLabel: "Mercado",
    categoryIcon: "ShoppingCart",
    categoryColor: "text-red-500",
    groupSlug: "despesas",
    groupLabel: "Despesas",
    groupColor: "bg-red-500",
  },
  {
    transactionId: 102,
    description: "Farmacia",
    amount: -80,
    occurredOn: "2026-04-11",
    isRecurring: false,
    housingId: null,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    cardId: 2,
    cardSlug: "nubank",
    cardName: "Nubank",
    cardColor: "bg-violet-500",
    statementCloseDay: 10,
    statementDueDay: 20,
    notifyInvoiceClosed: true,
    notifyInvoiceDueSoon: false,
    invoiceDueReminderDays: 3,
    categoryId: 8,
    categorySlug: "saude",
    categoryLabel: "Saude",
    categoryIcon: "HeartPulse",
    categoryColor: "text-emerald-500",
    groupSlug: "despesas",
    groupLabel: "Despesas",
    groupColor: "bg-red-500",
  },
  {
    transactionId: 201,
    description: "Curso",
    amount: -300,
    occurredOn: "2026-04-20",
    isRecurring: false,
    housingId: null,
    installmentPurchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    purchaseOccurredOn: null,
    cardId: 3,
    cardSlug: "visa",
    cardName: "Visa",
    cardColor: "bg-blue-500",
    statementCloseDay: 25,
    statementDueDay: 5,
    notifyInvoiceClosed: false,
    notifyInvoiceDueSoon: true,
    invoiceDueReminderDays: 5,
    categoryId: 9,
    categorySlug: "educacao",
    categoryLabel: "Educacao",
    categoryIcon: "BookOpen",
    categoryColor: "text-blue-500",
    groupSlug: "despesas",
    groupLabel: "Despesas",
    groupColor: "bg-red-500",
  },
];

describe("invoice service helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups transactions into calculated invoices", () => {
    const response = buildInvoicesResponse(rows, cards, {}, "2026-04-12");

    expect(response.invoices).toHaveLength(3);
    expect(response.invoices.find((invoice) => invoice.id === "2-2026-04-10")).toMatchObject({
      periodStart: "2026-03-11",
      periodEnd: "2026-04-10",
      totalAmount: 120,
      status: "closed",
      transactionCount: 1,
    });
    expect(response.invoices.find((invoice) => invoice.id === "2-2026-05-10")).toMatchObject({
      periodStart: "2026-04-11",
      periodEnd: "2026-05-10",
      dueDate: "2026-05-20",
      totalAmount: 80,
    });
  });

  it("filters by card, reference period, status, category and search", () => {
    const response = buildInvoicesResponse(
      rows,
      cards,
      {
        cardId: "2",
        referenceStart: "2026-04-01",
        referenceEnd: "2026-04-30",
        status: "closed",
        categoryId: "7",
        search: "merc",
      },
      "2026-04-12",
    );

    expect(response.invoices).toHaveLength(1);
    expect(response.invoices[0]).toMatchObject({
      id: "2-2026-04-10",
      totalAmount: 120,
      transactionCount: 1,
    });
    expect(response.summary).toMatchObject({
      totalAmount: 120,
      activeCardsCount: 1,
      invoiceCount: 1,
    });
  });

  it("deduplicates generated invoice notifications through the event table", async () => {
    let inserted = false;
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO invoice_notification_events")) {
          if (inserted) {
            return { rows: [], rowCount: 0 };
          }

          inserted = true;
          return { rows: [{ id: 77 }], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    connectMock.mockResolvedValue(client);
    createSystemNotificationForUserMock.mockResolvedValue(88);

    await generateInvoiceNotificationsForUser(7, "2026-04-12", { cards, rows });
    await generateInvoiceNotificationsForUser(7, "2026-04-12", { cards, rows });

    expect(createSystemNotificationForUserMock).toHaveBeenCalledTimes(1);
    expect(createSystemNotificationForUserMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        category: "invoice_due",
        actionHref: "/gestao-de-gastos/faturas",
      }),
      client,
    );
  });
});
