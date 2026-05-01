function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferSourceKind(rows = [], metadata = {}) {
  const filename = normalizeText(metadata.filename);
  const issuerName = normalizeText(metadata.issuerName);
  const explicitHint = normalizeText(metadata.requestedImportSource);

  if (explicitHint === "credit_card_statement" || explicitHint === "bank_statement") {
    return {
      sourceKind: explicitHint,
      confidence: 1,
      warnings: [],
    };
  }

  const creditHints = ["fatura", "cartao", "credito", "mastercard", "visa"];
  const bankHints = ["extrato", "corrente", "conta", "checking"];
  const serializedRows = rows
    .slice(0, 60)
    .map((row) => normalizeText(`${row.description ?? ""} ${row.memo ?? ""}`))
    .join(" ");
  const hasInstallment = /\b\d{1,2}\/\d{1,2}\b/.test(serializedRows) || /parcela/.test(serializedRows);
  const creditScore =
    Number(hasInstallment) * 3 +
    Number(creditHints.some((hint) => filename.includes(hint) || issuerName.includes(hint))) * 2;
  const bankScore = Number(bankHints.some((hint) => filename.includes(hint) || issuerName.includes(hint))) * 2;

  if (creditScore > bankScore) {
    return {
      sourceKind: "credit_card_statement",
      confidence: Math.min(0.95, 0.55 + creditScore * 0.1),
      warnings: [],
    };
  }

  return {
    sourceKind: "bank_statement",
    confidence: bankScore > 0 ? 0.85 : 0.6,
    warnings: bankScore > 0 ? [] : ["Tipo do arquivo inferido como extrato bancario. Revise antes de confirmar."],
  };
}
