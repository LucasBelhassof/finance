import { describe, expect, it } from "vitest";

import {
  buildImportSeedKey,
  createImportPreview,
  extractCategorizationMatchKey,
  enrichPreviewSessionWithAi,
  getPreviewSession,
  isPreviewItemEligibleForAi,
  normalizeAiCategorizationResult,
  resolveAllowedCategoryMap,
  parseAmountInput,
  parseOccurredOnInput,
  validateCommitLine,
} from "./transaction-import.js";

const categories = [
  { id: 1, slug: "restaurantes", label: "Restaurantes", transactionType: "expense" },
  { id: 2, slug: "transporte", label: "Transporte", transactionType: "expense" },
  { id: 3, slug: "salario", label: "Salario", transactionType: "income" },
];

describe("transaction import helpers", () => {
  it("normalizes supported monetary formats", () => {
    expect(parseAmountInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseAmountInput("1,234.56")).toBe(1234.56);
    expect(parseAmountInput("(123,45)")).toBe(-123.45);
  });

  it("normalizes supported date formats", () => {
    expect(parseOccurredOnInput("06/04/2026")).toBe("2026-04-06");
    expect(parseOccurredOnInput("2026-04-06")).toBe("2026-04-06");
    expect(parseOccurredOnInput("06-04-2026")).toBe("2026-04-06");
  });

  it("builds a preview, ignores blank rows and flags duplicates", () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;iFood;-67,90",
      "",
      "06/04/2026;iFood;-67,90",
      "05/04/2026;Salario;6500,00",
    ].join("\n");
    const existingFingerprints = new Set([
      buildImportSeedKey(1, "2026-04-06", -67.9, "ifood"),
    ]);

    const preview = createImportPreview({
      categories,
      existingFingerprints,
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.fileSummary.totalRows).toBe(3);
    expect(preview.fileSummary.duplicateRows).toBe(2);
    expect(preview.items[0].matchedRuleId).toBe("ifood");
    expect(preview.items[0].possibleDuplicate).toBe(true);
    expect(preview.items[2].type).toBe("income");
    expect(preview.items[2].suggestedCategoryId).toBe(3);
  });

  it("reads Nubank credit card CSVs with date,title,amount and interprets purchases as expenses", () => {
    const csv = [
      "date,title,amount",
      "2026-03-19,iFood - NuPay,30.99",
      "2026-03-18,Pagamento recebido,-377.84",
      "2026-03-15,Uber - NuPay,13.95",
    ].join("\n");

    const preview = createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      importSource: "credit_card_statement",
      userId: 1,
    });

    expect(preview.fileSummary.totalRows).toBe(3);
    expect(preview.items[0].description).toBe("iFood - NuPay");
    expect(preview.items[0].type).toBe("expense");
    expect(preview.items[0].suggestedCategoryId).toBe(1);
    expect(preview.items[1].description).toBe("Pagamento recebido");
    expect(preview.items[1].type).toBe("income");
    expect(preview.items[1].defaultExclude).toBe(true);
    expect(preview.items[2].type).toBe("expense");
    expect(preview.items[2].suggestedCategoryId).toBe(2);
  });

  it("reuses the user's historical categorization before AI", () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS;396,00",
    ].join("\n");

    const preview = createImportPreview({
      categories,
      existingFingerprints: new Set(),
      historicalRows: [
        {
          description: "Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS",
          amount: 400,
          category_id: 3,
          occurred_on: "2026-03-06",
        },
      ],
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0].type).toBe("income");
    expect(preview.items[0].suggestedCategoryId).toBe(3);
    expect(preview.items[0].suggestionSource).toBe("history");
  });

  it("prioritizes recurring rules over transaction history", () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS;396,00",
    ].join("\n");

    const preview = createImportPreview({
      categories,
      existingFingerprints: new Set(),
      historicalRows: [
        {
          description: "Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS",
          amount: 400,
          category_id: 2,
          occurred_on: "2026-03-06",
        },
      ],
      recurringRules: [
        {
          match_key: "levi augusto pereira dos santos",
          type: "income",
          category_id: 3,
          times_confirmed: 3,
        },
      ],
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0].type).toBe("income");
    expect(preview.items[0].suggestedCategoryId).toBe(3);
    expect(preview.items[0].suggestionSource).toBe("recurring_rule");
  });

  it("revalidates commit lines with signed amount derived from type", () => {
    const line = validateCommitLine(
      {
        description: "iFood",
        amount: "67.90",
        occurredOn: "2026-04-06",
        type: "expense",
        categoryId: 1,
      },
      categories,
    );

    expect(line.signedAmount).toBe(-67.9);
    expect(line.normalizedFinalDescription).toBe("ifood");
    expect(line.normalizedOccurredOn).toBe("2026-04-06");
  });

  it("rejects a category that does not match the transaction type", () => {
    expect(() =>
      validateCommitLine(
        {
          description: "Salario pago",
          amount: "1000.00",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 3,
        },
        categories,
      ),
    ).toThrow("nao corresponde ao tipo");
  });

  it("keeps rows with local rule matches out of AI enrichment", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;iFood;-67,90",
      "06/04/2026;Transferencia recebida;396,00",
    ].join("\n");

    const preview = createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = getPreviewSession(preview.previewToken, 1);
    const suggestCategories = async ({ items }) =>
      items.map((item) => ({
        rowIndex: item.rowIndex,
        suggestedType: "income",
        categoryKey: "salary",
        confidence: 0.92,
        reason: "Transferencia associada a recebimento.",
        status: "suggested",
      }));

    const result = await enrichPreviewSessionWithAi({
      session,
      categories,
      rowIndexes: [1, 2],
      maxRows: 100,
      suggestCategories,
    });

    expect(result.items[0].rowIndex).toBe(1);
    expect(result.items[0].aiStatus).toBe("no_match");
    expect(result.items[1].rowIndex).toBe(2);
    expect(result.items[1].aiStatus).toBe("suggested");
    expect(result.items[1].aiSuggestedType).toBe("income");
    expect(result.summary.suggestedRows).toBe(1);
  });

  it("rejects invalid AI categories outside the whitelist", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: "expense",
        categoryKey: "unknown",
        confidence: 0.9,
        reason: "Resposta invalida",
        status: "suggested",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("invalid");
    expect(normalized.aiSuggestedCategoryId).toBeNull();
  });

  it("treats out-of-range confidence as invalid metadata", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: "expense",
        categoryKey: "salary",
        confidence: 1.2,
        reason: "Confianca invalida",
        status: "suggested",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("invalid");
    expect(normalized.aiConfidence).toBeNull();
  });

  it("skips AI when the normalized description is too weak", () => {
    expect(
      isPreviewItemEligibleForAi({
        errors: [],
        suggestedCategoryId: null,
        normalizedDescription: "pix",
      }),
    ).toBe(false);
  });

  it("caches AI suggestions inside the preview session", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida;396,00",
    ].join("\n");
    const preview = createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = getPreviewSession(preview.previewToken, 1);
    let callCount = 0;
    const suggestCategories = async ({ items }) => {
      callCount += 1;

      return items.map((item) => ({
        rowIndex: item.rowIndex,
        suggestedType: "income",
        categoryKey: "salary",
        confidence: 0.94,
        reason: "Recebimento com alta semelhanca.",
        status: "suggested",
      }));
    };

    const first = await enrichPreviewSessionWithAi({
      session,
      categories,
      rowIndexes: [1],
      maxRows: 100,
      suggestCategories,
    });
    const second = await enrichPreviewSessionWithAi({
      session,
      categories,
      rowIndexes: [1],
      maxRows: 100,
      suggestCategories,
    });

    expect(callCount).toBe(1);
    expect(first.items[0].aiSuggestedCategoryId).toBe(3);
    expect(first.items[0].aiSuggestedType).toBe("income");
    expect(second.items[0].aiSuggestedCategoryId).toBe(3);
  });

  it("marks AI results without suggestedType as invalid", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: null,
        categoryKey: "salary",
        confidence: 0.9,
        reason: "Recebimento identificado",
        status: "suggested",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("invalid");
    expect(normalized.aiSuggestedType).toBeNull();
  });

  it("keeps semantic type when AI returns no_match without category", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: "income",
        categoryKey: null,
        confidence: 0.87,
        reason: "Transferencia recebida sem categoria especifica",
        status: "no_match",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("no_match");
    expect(normalized.aiSuggestedType).toBe("income");
    expect(normalized.aiSuggestedCategoryId).toBeNull();
    expect(normalized.aiConfidence).toBe(0.87);
  });

  it("rejects AI enrichment requests above the row limit", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida;396,00",
      "06/04/2026;Pagamento recebido;100,00",
    ].join("\n");
    const preview = createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = getPreviewSession(preview.previewToken, 1);

    await expect(
      enrichPreviewSessionWithAi({
        session,
        categories,
        rowIndexes: [1, 2],
        maxRows: 1,
        suggestCategories: async () => [],
      }),
    ).rejects.toThrow("no maximo 1 linhas");
  });

  it("extracts a useful match key from noisy banking descriptions", () => {
    expect(
      extractCategorizationMatchKey(
        "Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS - 308838 - BCO C6 S.A. Agencia 1 Conta 3793065-6",
      ),
    ).toBe("levi augusto pereira dos santos");
  });
});
