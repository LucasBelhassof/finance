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

  const serializedRows = rows
    .slice(0, 80)
    .map((row) => normalizeText(`${row.description ?? ""} ${row.memo ?? ""}`))
    .join(" ");
  const positiveRows = rows.filter((row) => Number(row.amount) > 0).length;
  const negativeRows = rows.filter((row) => Number(row.amount) < 0).length;
  const hasBalance = rows.some((row) => row.balanceAfter !== null && row.balanceAfter !== undefined);
  const hasInstallment = /\b\d{1,2}\/\d{1,2}\b/.test(serializedRows) || /parcela/.test(serializedRows);
  const hasBankTerms = /(pix|ted|doc|saque|transferencia|deposito|boleto)/.test(serializedRows);
  const hasCardTerms = /(fatura|cartao|credito|compra|anuidade|limite)/.test(
    `${serializedRows} ${filename} ${issuerName}`,
  );

  const creditScore =
    Number(hasInstallment) * 3 + Number(hasCardTerms) * 2 + Number(negativeRows > 0 && positiveRows === 0);
  const bankScore = Number(hasBankTerms) * 2 + Number(hasBalance) * 2 + Number(positiveRows > 0 && negativeRows > 0);

  if (creditScore >= bankScore + 2) {
    return {
      sourceKind: "credit_card_statement",
      confidence: Math.min(0.96, 0.56 + creditScore * 0.1),
      warnings: [],
    };
  }

  if (bankScore >= creditScore + 2) {
    return {
      sourceKind: "bank_statement",
      confidence: Math.min(0.94, 0.56 + bankScore * 0.08),
      warnings: [],
    };
  }

  if (rows.length > 0) {
    return {
      sourceKind: "generic_transactions",
      confidence: 0.5,
      warnings: [],
    };
  }

  return {
    sourceKind: "unknown",
    confidence: 0.2,
    warnings: [],
  };
}
