const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const priorityScores = {
  high: 300,
  medium: 200,
  low: 100,
};

const typeOrder = {
  low_balance_risk: 90,
  spending_spike: 80,
  installment_pressure: 70,
  unusual_expense: 60,
  category_concentration: 50,
  recurring_charges: 40,
  top_category: 30,
};

function toNumber(value) {
  return Number.parseFloat(value ?? 0);
}

function roundCurrency(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function formatCurrency(value) {
  return currencyFormatter.format(roundCurrency(value));
}

function parseDate(value) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
}

function toDateOnly(value) {
  return parseDate(value).toISOString().slice(0, 10);
}

function startOfMonth(value) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(value, months) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)).toISOString().slice(0, 10);
}

function monthKey(value) {
  return String(value).slice(0, 7);
}

function formatPercent(value) {
  return `${Math.round(toNumber(value) * 100)}%`;
}

function normalizeDescription(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bparcela\s+\d{1,2}\s*(?:de|\/)\s*\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function groupMedian(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function buildCategorySummaries(transactions, totalExpenses) {
  const grouped = new Map();

  for (const transaction of transactions) {
    const key = transaction.groupSlug ?? transaction.categorySlug ?? "outros";
    const existing = grouped.get(key) ?? {
      categorySlug: key,
      categoryLabel: transaction.groupLabel ?? transaction.categoryLabel ?? "Outros",
      total: 0,
      count: 0,
    };

    existing.total += transaction.amount;
    existing.count += 1;
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map((category) => ({
      ...category,
      total: roundCurrency(category.total),
      share: totalExpenses > 0 ? category.total / totalExpenses : 0,
    }))
    .sort((left, right) => right.total - left.total || left.categoryLabel.localeCompare(right.categoryLabel, "pt-BR"));
}

function buildRecurringCharges(transactions) {
  const grouped = new Map();

  for (const transaction of transactions) {
    if (transaction.isInstallment) {
      continue;
    }

    const merchantKey = normalizeDescription(transaction.description);

    if (!merchantKey || merchantKey.length < 4) {
      continue;
    }

    const key = `${merchantKey}|${transaction.amount.toFixed(2)}`;
    const existing = grouped.get(key) ?? {
      key,
      merchantKey,
      description: transaction.description,
      amount: transaction.amount,
      dates: [],
      categories: new Set(),
    };

    existing.dates.push(transaction.occurredOn);
    existing.categories.add(transaction.groupLabel ?? transaction.categoryLabel ?? "Outros");
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .map((entry) => {
      const dates = entry.dates
        .map((value) => toDateOnly(value))
        .sort((left, right) => parseDate(left).getTime() - parseDate(right).getTime());
      const uniqueMonths = new Set(dates.map(monthKey));
      const intervals = [];

      for (let index = 1; index < dates.length; index += 1) {
        const current = parseDate(dates[index]).getTime();
        const previous = parseDate(dates[index - 1]).getTime();
        intervals.push(Math.round((current - previous) / 86400000));
      }

      const monthlyCadence = intervals.length > 0 && intervals.every((value) => value >= 25 && value <= 40);

      return {
        key: entry.key,
        description: entry.description,
        amount: roundCurrency(entry.amount),
        occurrences: dates.length,
        uniqueMonthCount: uniqueMonths.size,
        latestDate: dates[dates.length - 1],
        categoryLabels: [...entry.categories],
        isRecurring: uniqueMonths.size >= 3 && monthlyCadence,
      };
    })
    .filter((entry) => entry.isRecurring)
    .sort((left, right) => right.amount - left.amount || right.occurrences - left.occurrences);
}

function buildOutlierCandidate(currentMonthExpenses, historicalExpenses) {
  if (!currentMonthExpenses.length) {
    return null;
  }

  const historicalByCategory = new Map();

  for (const transaction of historicalExpenses) {
    const key = transaction.groupSlug ?? transaction.categorySlug ?? "outros";
    const entries = historicalByCategory.get(key) ?? [];
    entries.push(transaction.amount);
    historicalByCategory.set(key, entries);
  }

  const candidates = currentMonthExpenses
    .filter((transaction) => !transaction.isInstallment)
    .map((transaction) => {
      const key = transaction.groupSlug ?? transaction.categorySlug ?? "outros";
      const baseline = historicalByCategory.get(key) ?? [];
      const average = baseline.length ? baseline.reduce((sum, value) => sum + value, 0) / baseline.length : 0;
      const median = groupMedian(baseline);
      const reference = Math.max(average, median);
      const ratio = reference > 0 ? transaction.amount / reference : 0;

      return {
        transaction,
        baselineCount: baseline.length,
        baselineAverage: roundCurrency(average),
        ratio,
      };
    })
    .filter((candidate) => candidate.baselineCount >= 2 && candidate.transaction.amount >= 120)
    .filter((candidate) => candidate.ratio >= 1.8 && candidate.transaction.amount - candidate.baselineAverage >= 80)
    .sort((left, right) => right.ratio - left.ratio || right.transaction.amount - left.transaction.amount);

  return candidates[0] ?? null;
}

export function buildMonthlySpendingSnapshot({ transactions = [], balances = [], referenceDate = null }) {
  const normalizedTransactions = [...transactions]
    .map((transaction) => ({
      ...transaction,
      amount: roundCurrency(Math.abs(toNumber(transaction.amount))),
      occurredOn: toDateOnly(transaction.occurredOn),
      isInstallment: Boolean(transaction.isInstallment),
    }))
    .filter((transaction) => transaction.amount > 0)
    .sort((left, right) => parseDate(right.occurredOn).getTime() - parseDate(left.occurredOn).getTime());

  const latestTransactionDate = normalizedTransactions[0]?.occurredOn ?? null;
  const resolvedReferenceDate = referenceDate
    ? toDateOnly(referenceDate)
    : latestTransactionDate ?? new Date().toISOString().slice(0, 10);
  const currentMonthStart = startOfMonth(resolvedReferenceDate);
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const nextMonthStart = addMonths(currentMonthStart, 1);
  const recent14Cutoff = addDays(resolvedReferenceDate, -13);
  const historicalCutoff = addDays(currentMonthStart, -90);

  const currentMonthExpenses = normalizedTransactions.filter(
    (transaction) => transaction.occurredOn >= currentMonthStart && transaction.occurredOn < nextMonthStart,
  );
  const previousMonthExpenses = normalizedTransactions.filter(
    (transaction) => transaction.occurredOn >= previousMonthStart && transaction.occurredOn < currentMonthStart,
  );
  const recent14DayExpenses = normalizedTransactions.filter(
    (transaction) => transaction.occurredOn >= recent14Cutoff && transaction.occurredOn <= resolvedReferenceDate,
  );
  const historicalExpenses = normalizedTransactions.filter(
    (transaction) => transaction.occurredOn >= historicalCutoff && transaction.occurredOn < currentMonthStart,
  );
  const currentMonthTotal = roundCurrency(currentMonthExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const previousMonthTotal = roundCurrency(previousMonthExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const recent14DayTotal = roundCurrency(recent14DayExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const totalBalance = roundCurrency(balances.reduce((sum, value) => sum + toNumber(value), 0));
  const categorySummaries = buildCategorySummaries(currentMonthExpenses, currentMonthTotal);
  const topCategory = categorySummaries[0] ?? null;
  const previousCategorySummaries = buildCategorySummaries(previousMonthExpenses, previousMonthTotal);
  const previousTopCategory = previousCategorySummaries[0] ?? null;
  const installmentTransactions = currentMonthExpenses.filter((transaction) => transaction.isInstallment);
  const installmentTotal = roundCurrency(installmentTransactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  const recurringCharges = buildRecurringCharges(
    normalizedTransactions.filter((transaction) => transaction.occurredOn >= historicalCutoff),
  );

  return {
    referenceDate: resolvedReferenceDate,
    referenceMonth: monthKey(currentMonthStart),
    currentMonthStart,
    previousMonthStart,
    hasExpenses: normalizedTransactions.length > 0,
    currentMonthExpenses,
    previousMonthExpenses,
    historicalExpenses,
    currentMonthTotal,
    previousMonthTotal,
    recent14DayTotal,
    totalBalance,
    categorySummaries,
    topCategory,
    previousTopCategory,
    installmentSummary: {
      total: installmentTotal,
      share: currentMonthTotal > 0 ? installmentTotal / currentMonthTotal : 0,
      transactionsCount: installmentTransactions.length,
      purchaseCount: new Set(
        installmentTransactions.map((transaction) => transaction.installmentPurchaseId).filter((value) => value !== null && value !== undefined),
      ).size,
    },
    recurringCharges,
    outlierCandidate: buildOutlierCandidate(currentMonthExpenses, historicalExpenses),
  };
}

function createInsight({
  id,
  title,
  description,
  tag,
  tone,
  priority,
  insightType,
  metadata,
  action = null,
  semanticGroup = null,
}) {
  return {
    id,
    title,
    description,
    tag,
    tone,
    priority,
    insightType,
    metadata,
    action,
    semanticGroup,
  };
}

export function detectTopCategoryInsight(snapshot) {
  const topCategory = snapshot.topCategory;

  if (!topCategory || snapshot.currentMonthTotal < 250 || topCategory.share < 0.28) {
    return null;
  }

  return createInsight({
    id: `top-category-${snapshot.referenceMonth}-${topCategory.categorySlug}`,
    title: `${topCategory.categoryLabel} lidera seus gastos`,
    description: `${topCategory.categoryLabel} ja soma ${formatCurrency(topCategory.total)} no mes (${formatPercent(topCategory.share)} do total). Vale revisar as ultimas compras dessa categoria.`,
    tag: "Categoria",
    tone: topCategory.share >= 0.4 ? "warning" : "info",
    priority: topCategory.share >= 0.4 ? "medium" : "low",
    insightType: "top_category",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      categorySlug: topCategory.categorySlug,
      categoryLabel: topCategory.categoryLabel,
      amount: topCategory.total,
      share: roundCurrency(topCategory.share),
    },
    action: {
      kind: "review_transactions",
      label: "Revisar transacoes",
    },
    semanticGroup: `category-focus:${topCategory.categorySlug}`,
  });
}

export function detectSpendingSpikeInsight(snapshot) {
  if (snapshot.previousMonthTotal < 300 || snapshot.currentMonthTotal <= snapshot.previousMonthTotal) {
    return null;
  }

  const increaseAmount = roundCurrency(snapshot.currentMonthTotal - snapshot.previousMonthTotal);
  const increaseRatio = increaseAmount / snapshot.previousMonthTotal;

  if (increaseRatio < 0.2 || increaseAmount < 150) {
    return null;
  }

  return createInsight({
    id: `spending-spike-${snapshot.referenceMonth}`,
    title: "Seus gastos aceleraram neste periodo",
    description: `As despesas subiram ${formatPercent(increaseRatio)} em relacao ao mes anterior, um aumento de ${formatCurrency(increaseAmount)}. Revise o que mudou antes que esse ritmo vire padrao.`,
    tag: "Tendencia",
    tone: increaseRatio >= 0.35 ? "warning" : "info",
    priority: increaseRatio >= 0.35 ? "high" : "medium",
    insightType: "spending_spike",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      currentMonthExpenses: snapshot.currentMonthTotal,
      previousMonthExpenses: snapshot.previousMonthTotal,
      increaseAmount,
      increaseRatio: roundCurrency(increaseRatio),
    },
    action: {
      kind: "review_transactions",
      label: "Entender aumento",
    },
  });
}

export function detectRecurringChargesInsight(snapshot) {
  const recurringCharges = snapshot.recurringCharges.slice(0, 3);

  if (!recurringCharges.length) {
    return null;
  }

  const totalRecurring = roundCurrency(recurringCharges.reduce((sum, charge) => sum + charge.amount, 0));

  if (totalRecurring < 30) {
    return null;
  }

  const labels = recurringCharges.map((charge) => charge.description).slice(0, 2);
  const descriptions = labels.join(" e ");

  return createInsight({
    id: `recurring-${snapshot.referenceMonth}`,
    title: "Cobrancas recorrentes detectadas",
    description: `Identifiquei ${recurringCharges.length} gasto${recurringCharges.length > 1 ? "s" : ""} com ritmo mensal, somando ${formatCurrency(totalRecurring)}. Comece por ${descriptions} e corte o que nao entrega uso real.`,
    tag: "Recorrencia",
    tone: totalRecurring >= 200 ? "warning" : "info",
    priority: totalRecurring >= 200 ? "medium" : "low",
    insightType: "recurring_charges",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      recurringCount: recurringCharges.length,
      totalRecurring,
      recurringCharges: recurringCharges.map((charge) => ({
        description: charge.description,
        amount: charge.amount,
        occurrences: charge.occurrences,
        latestDate: charge.latestDate,
      })),
    },
    action: {
      kind: "review_transactions",
      label: "Auditar recorrencias",
    },
  });
}

export function detectOutlierInsight(snapshot) {
  const candidate = snapshot.outlierCandidate;

  if (!candidate) {
    return null;
  }

  return createInsight({
    id: `outlier-${candidate.transaction.id}`,
    title: "Gasto fora do seu padrao recente",
    description: `${candidate.transaction.description} saiu por ${formatCurrency(candidate.transaction.amount)}, cerca de ${Math.round(candidate.ratio * 10) / 10}x a sua media recente dessa categoria. Veja se foi compra pontual ou se precisa ajustar o teto do mes.`,
    tag: "Fora do padrao",
    tone: "warning",
    priority: "high",
    insightType: "unusual_expense",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      transactionId: candidate.transaction.id,
      description: candidate.transaction.description,
      amount: candidate.transaction.amount,
      categorySlug: candidate.transaction.groupSlug ?? candidate.transaction.categorySlug ?? "outros",
      categoryLabel: candidate.transaction.groupLabel ?? candidate.transaction.categoryLabel ?? "Outros",
      baselineAverage: candidate.baselineAverage,
      ratio: roundCurrency(candidate.ratio),
    },
    action: {
      kind: "review_transactions",
      label: "Ver compra",
    },
  });
}

export function detectCategoryConcentrationInsight(snapshot) {
  const topCategory = snapshot.topCategory;

  if (!topCategory || snapshot.currentMonthTotal < 350 || topCategory.share < 0.5) {
    return null;
  }

  return createInsight({
    id: `category-concentration-${snapshot.referenceMonth}-${topCategory.categorySlug}`,
    title: "Seu mes esta concentrado em uma unica categoria",
    description: `${topCategory.categoryLabel} representa ${formatPercent(topCategory.share)} das despesas do mes. Se essa categoria nao for planejada, defina um limite para ela ainda nesta semana.`,
    tag: "Concentracao",
    tone: "warning",
    priority: topCategory.share >= 0.6 ? "high" : "medium",
    insightType: "category_concentration",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      categorySlug: topCategory.categorySlug,
      categoryLabel: topCategory.categoryLabel,
      amount: topCategory.total,
      share: roundCurrency(topCategory.share),
    },
    action: {
      kind: "review_transactions",
      label: "Abrir categoria",
    },
    semanticGroup: `category-focus:${topCategory.categorySlug}`,
  });
}

export function detectLowBalanceRiskInsight(snapshot) {
  if (snapshot.recent14DayTotal <= 0) {
    return null;
  }

  const runwayRatio = snapshot.totalBalance / snapshot.recent14DayTotal;

  if (runwayRatio > 1.2) {
    return null;
  }

  return createInsight({
    id: `low-balance-${snapshot.referenceMonth}`,
    title: "Seu saldo esta apertado para o ritmo recente",
    description: `O saldo atual soma ${formatCurrency(snapshot.totalBalance)} e os ultimos 14 dias consumiram ${formatCurrency(snapshot.recent14DayTotal)}. Segure gastos discricionarios e acompanhe contas a vencer.`,
    tag: "Saldo",
    tone: "warning",
    priority: runwayRatio <= 0.8 ? "high" : "medium",
    insightType: "low_balance_risk",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      totalBalance: snapshot.totalBalance,
      recent14DayExpenses: snapshot.recent14DayTotal,
      runwayRatio: roundCurrency(runwayRatio),
    },
    action: {
      kind: "review_accounts",
      label: "Ver saldos",
    },
  });
}

export function detectInstallmentPressureInsight(snapshot) {
  const installmentSummary = snapshot.installmentSummary;

  if (installmentSummary.total < 250 || installmentSummary.share < 0.2 || installmentSummary.purchaseCount < 2) {
    return null;
  }

  return createInsight({
    id: `installments-${snapshot.referenceMonth}`,
    title: "Parcelamentos estao pesando no mes",
    description: `As parcelas comprometem ${formatCurrency(installmentSummary.total)} neste periodo (${formatPercent(installmentSummary.share)} das despesas). Vale rever novas compras parceladas ate esse peso diminuir.`,
    tag: "Parcelas",
    tone: installmentSummary.share >= 0.3 ? "warning" : "info",
    priority: installmentSummary.share >= 0.3 ? "high" : "medium",
    insightType: "installment_pressure",
    metadata: {
      referenceMonth: snapshot.referenceMonth,
      installmentTotal: installmentSummary.total,
      installmentShare: roundCurrency(installmentSummary.share),
      installmentTransactionsCount: installmentSummary.transactionsCount,
      installmentPurchaseCount: installmentSummary.purchaseCount,
    },
    action: {
      kind: "review_installments",
      label: "Ver parcelamentos",
    },
  });
}

function scoreInsight(insight) {
  return (priorityScores[insight.priority] ?? 0) + (typeOrder[insight.insightType] ?? 0);
}

function dedupeInsights(insights) {
  const deduped = [];
  const seen = new Set();

  for (const insight of insights) {
    const key = insight.semanticGroup ?? `${insight.insightType}:${insight.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(insight);
  }

  return deduped;
}

export function rankInsights(insights, limit = 4) {
  return dedupeInsights(
    [...insights].sort((left, right) => scoreInsight(right) - scoreInsight(left) || left.title.localeCompare(right.title, "pt-BR")),
  ).slice(0, limit);
}

export function generateInsights(input, options = {}) {
  const snapshot = buildMonthlySpendingSnapshot(input);

  if (!snapshot.hasExpenses) {
    return [];
  }

  const insights = [
    detectLowBalanceRiskInsight(snapshot),
    detectSpendingSpikeInsight(snapshot),
    detectInstallmentPressureInsight(snapshot),
    detectOutlierInsight(snapshot),
    detectCategoryConcentrationInsight(snapshot),
    detectRecurringChargesInsight(snapshot),
    detectTopCategoryInsight(snapshot),
  ].filter(Boolean);

  return rankInsights(insights, options.limit ?? 4).map(({ semanticGroup, ...insight }) => insight);
}
