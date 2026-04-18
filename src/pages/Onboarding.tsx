import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useBanks, useCreateBankConnection } from "@/hooks/use-banks";
import { useDashboard, dashboardQueryKey } from "@/hooks/use-dashboard";
import { insightsQueryKey, spendingQueryKey } from "@/hooks/use-insights";
import {
  transactionsQueryKey,
  useCategories,
  useCreateTransaction,
  useTransactions,
} from "@/hooks/use-transactions";
import { ACCOUNT_COLOR_PRESETS, getSuggestedAccountColor } from "@/lib/account-colors";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import * as authService from "@/modules/auth/services/auth-service";
import type { AuthOnboardingProgress, OnboardingStepId } from "@/modules/auth/types/auth-types";
import type { CreateBankConnectionInput, CreateTransactionInput } from "@/types/api";

type StarterAccountType = "bank_account" | "cash";
type TransactionType = "income" | "expense";
type StepStatus = "completed" | "current" | "upcoming";

type StarterForm = {
  name: string;
  accountType: StarterAccountType;
  currentBalance: string;
  color: string;
};

type TransactionForm = {
  transactionType: TransactionType;
  description: string;
  amount: string;
  occurredOn: string;
  categoryId: string;
  bankConnectionId: string;
};

const STEP_DEFS: Array<{
  id: OnboardingStepId;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "welcome",
    title: "Boas-vindas",
    description: "Entenda o fluxo e siga para a ativacao minima com conta, primeira movimentacao e resultado real.",
    icon: Sparkles,
  },
  {
    id: "account",
    title: "Criar primeira conta",
    description: "Cadastre uma conta simples com saldo inicial para criar a base do dashboard.",
    icon: PiggyBank,
  },
  {
    id: "first_transaction",
    title: "Criar primeira transacao",
    description: "Registre sua primeira entrada ou saida para ver o produto funcionando com dados reais.",
    icon: Receipt,
  },
  {
    id: "result",
    title: "Ver resultado",
    description: "Confira o impacto imediato no resumo e finalize o onboarding abrindo o dashboard.",
    icon: LayoutDashboard,
  },
];

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeOnboardingStep(step: unknown): OnboardingStepId | null {
  switch (step) {
    case "welcome":
    case "account":
    case "first_transaction":
    case "result":
      return step;
    case "profile":
      return "welcome";
    case "dashboard":
      return "result";
    default:
      return null;
  }
}

function uniqueSteps(steps: unknown[]) {
  const normalized = steps
    .map((step) => normalizeOnboardingStep(step))
    .filter((step): step is OnboardingStepId => step !== null);

  return STEP_DEFS.map((step) => step.id).filter((stepId) => normalized.includes(stepId));
}

function normalizeProgress(progress?: Partial<AuthOnboardingProgress> | null): AuthOnboardingProgress {
  return {
    currentStep: Math.max(0, Math.min(STEP_DEFS.length - 1, progress?.currentStep ?? 0)),
    completedSteps: uniqueSteps(progress?.completedSteps ?? []),
    skippedSteps: uniqueSteps(progress?.skippedSteps ?? []),
    dismissed: Boolean(progress?.dismissed),
  };
}

function getDefaultAccountForm(accountType: StarterAccountType = "bank_account"): StarterForm {
  return {
    name: accountType === "cash" ? "Carteira" : "Conta principal",
    accountType,
    currentBalance: "0,00",
    color: getSuggestedAccountColor("", accountType),
  };
}

function getDefaultTransactionForm(): TransactionForm {
  return {
    transactionType: "expense",
    description: "",
    amount: "",
    occurredOn: formatDateInput(),
    categoryId: "",
    bankConnectionId: "",
  };
}

function getRecommendedStepIndex(progress: AuthOnboardingProgress, hasAccount: boolean, hasTransaction: boolean) {
  if (!progress.completedSteps.includes("welcome")) {
    return 0;
  }

  if (!hasAccount) {
    return 1;
  }

  if (!hasTransaction) {
    return 2;
  }

  return 3;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUserState } = useAuthSession();
  const { data: banks = [] } = useBanks(Boolean(user));
  const { data: dashboardData, isLoading: isDashboardLoading } = useDashboard();
  const { data: transactions = [] } = useTransactions(5);
  const { data: categories = [] } = useCategories();
  const createBankConnection = useCreateBankConnection();
  const createTransaction = useCreateTransaction();

  const [welcomeGoal, setWelcomeGoal] = useState("");
  const [accountForm, setAccountForm] = useState<StarterForm>(getDefaultAccountForm());
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(getDefaultTransactionForm());
  const [activeStepId, setActiveStepId] = useState<OnboardingStepId>("welcome");
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [hasManualAccountColorSelection, setHasManualAccountColorSelection] = useState(false);

  const onboardingProgress = useMemo(() => normalizeProgress(user?.onboardingProgress), [user?.onboardingProgress]);
  const hasAnyAccount = banks.length > 0;
  const hasAnyTransaction = transactions.length > 0;
  const recommendedStepIndex = getRecommendedStepIndex(onboardingProgress, hasAnyAccount, hasAnyTransaction);
  const recommendedStepId = STEP_DEFS[recommendedStepIndex]?.id ?? "result";
  const transactionAccounts = useMemo(
    () =>
      banks.filter((bank) =>
        transactionForm.transactionType === "income" ? bank.accountType !== "credit_card" : true,
      ),
    [banks, transactionForm.transactionType],
  );
  const availableCategories = useMemo(
    () => categories.filter((category) => category.transactionType === transactionForm.transactionType),
    [categories, transactionForm.transactionType],
  );
  const balanceCard = dashboardData?.summaryCards.find((card) => card.label.toLowerCase().includes("saldo")) ?? null;
  const latestTransaction = dashboardData?.recentTransactions[0] ?? transactions[0] ?? null;

  const steps = STEP_DEFS.map((step, index) => {
    const completed =
      step.id === "account"
        ? onboardingProgress.completedSteps.includes(step.id) || hasAnyAccount
        : step.id === "first_transaction"
          ? onboardingProgress.completedSteps.includes(step.id) || hasAnyTransaction
          : step.id === "result"
            ? user?.hasCompletedOnboarding === true || onboardingProgress.completedSteps.includes(step.id)
            : onboardingProgress.completedSteps.includes(step.id);

    let status: StepStatus = "upcoming";

    if (completed) {
      status = "completed";
    } else if (step.id === activeStepId) {
      status = "current";
    }

    return {
      ...step,
      index,
      completed,
      status,
      isRecommended: step.id === recommendedStepId && !completed,
    };
  });

  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[recommendedStepIndex];
  const completedStepsCount = steps.filter((step) => step.completed).length;
  const progressValue = Math.round((completedStepsCount / steps.length) * 100);

  useEffect(() => {
    const nextStepId = STEP_DEFS[onboardingProgress.currentStep]?.id ?? recommendedStepId;
    setActiveStepId(nextStepId);
  }, [onboardingProgress.currentStep, recommendedStepId]);

  useEffect(() => {
    if (!transactionAccounts.length) {
      setTransactionForm((current) => ({ ...current, bankConnectionId: "" }));
      return;
    }

    setTransactionForm((current) => {
      if (transactionAccounts.some((bank) => String(bank.id) === current.bankConnectionId)) {
        return current;
      }

      return {
        ...current,
        bankConnectionId: String(transactionAccounts[0].id),
      };
    });
  }, [transactionAccounts]);

  useEffect(() => {
    if (!availableCategories.length) {
      setTransactionForm((current) => ({ ...current, categoryId: "" }));
      return;
    }

    setTransactionForm((current) => {
      if (availableCategories.some((category) => String(category.id) === current.categoryId)) {
        return current;
      }

      return {
        ...current,
        categoryId: String(availableCategories[0].id),
      };
    });
  }, [availableCategories]);

  const persistProgress = async (
    transform: (current: AuthOnboardingProgress) => AuthOnboardingProgress,
    options?: {
      hasAccount?: boolean;
      hasTransaction?: boolean;
      preserveDismissed?: boolean;
      preserveCurrentStep?: boolean;
    },
  ) => {
    setIsSavingProgress(true);

    try {
      const current = normalizeProgress(user?.onboardingProgress);
      const next = transform({
        ...current,
        completedSteps: [...current.completedSteps],
        skippedSteps: [...current.skippedSteps],
      });

      const sanitized = normalizeProgress({
        ...next,
        completedSteps: uniqueSteps(next.completedSteps),
        skippedSteps: uniqueSteps(next.skippedSteps.filter((step) => !next.completedSteps.includes(step))),
        dismissed: options?.preserveDismissed ? next.dismissed : false,
      });

      sanitized.currentStep = options?.preserveCurrentStep
        ? Math.max(0, Math.min(STEP_DEFS.length - 1, next.currentStep ?? current.currentStep))
        : getRecommendedStepIndex(
            sanitized,
            options?.hasAccount ?? hasAnyAccount,
            options?.hasTransaction ?? hasAnyTransaction,
          );

      const response = await authService.updateOnboardingProgress(sanitized);
      setUserState(response.user);
      setActiveStepId(STEP_DEFS[sanitized.currentStep]?.id ?? "result");
      return response.user;
    } catch (error) {
      toast.error("Nao foi possivel salvar seu progresso.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
      return null;
    } finally {
      setIsSavingProgress(false);
    }
  };

  const goBack = () => {
    const previous = steps[activeStep.index - 1];
    if (previous) {
      setActiveStepId(previous.id);
    }
  };

  const handleWelcomeStep = async () => {
    const nextUser = await persistProgress((current) => ({
      ...current,
      completedSteps: [...current.completedSteps, "welcome"],
      skippedSteps: current.skippedSteps.filter((step) => step !== "welcome"),
    }));

    if (nextUser) {
      toast.success("Vamos criar a base da sua conta.");
    }
  };

  const handleAccountStep = async () => {
    const currentBalance = parseCurrencyInput(accountForm.currentBalance);

    if (!accountForm.name.trim() || !Number.isFinite(currentBalance)) {
      toast.error("Informe um nome e um saldo inicial valido.");
      return;
    }

    try {
      await createBankConnection.mutateAsync({
        name: accountForm.name.trim(),
        accountType: accountForm.accountType,
        currentBalance,
        color: accountForm.color,
        connected: true,
      } satisfies CreateBankConnectionInput);

      await persistProgress(
        (current) => ({
          ...current,
          completedSteps: [...current.completedSteps, "account"],
          skippedSteps: current.skippedSteps.filter((step) => step !== "account"),
        }),
        { hasAccount: true },
      );

      toast.success("Conta criada. Agora vamos registrar a primeira movimentacao.");
      setAccountForm(getDefaultAccountForm());
      setHasManualAccountColorSelection(false);
    } catch (error) {
      toast.error("Nao foi possivel criar sua conta.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleFirstTransactionStep = async () => {
    const parsedAmount = parseCurrencyInput(transactionForm.amount);

    if (!transactionForm.description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !transactionForm.bankConnectionId) {
      toast.error("Preencha descricao, valor e conta para continuar.");
      return;
    }

    if (transactionForm.transactionType === "income" && !transactionForm.categoryId) {
      toast.error("Selecione uma categoria para a receita.");
      return;
    }

    const signedAmount = transactionForm.transactionType === "income" ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);

    try {
      await createTransaction.mutateAsync({
        description: transactionForm.description.trim(),
        amount: signedAmount,
        occurredOn: transactionForm.occurredOn,
        bankConnectionId: transactionForm.bankConnectionId,
        categoryId: transactionForm.categoryId || undefined,
      } satisfies CreateTransactionInput);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey }),
        queryClient.invalidateQueries({ queryKey: spendingQueryKey }),
        queryClient.invalidateQueries({ queryKey: insightsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["housing"] }),
        queryClient.invalidateQueries({ queryKey: ["installments", "overview"] }),
      ]);

      await persistProgress(
        (current) => ({
          ...current,
          completedSteps: [...current.completedSteps, "first_transaction"],
          skippedSteps: current.skippedSteps.filter((step) => step !== "first_transaction"),
        }),
        { hasTransaction: true },
      );

      toast.success("Primeira movimentacao registrada.");
      setTransactionForm(getDefaultTransactionForm());
    } catch (error) {
      toast.error("Nao foi possivel salvar a transacao.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleResultStep = async () => {
    if (!hasAnyAccount) {
      toast.error("Crie uma conta antes de concluir o onboarding.");
      setActiveStepId("account");
      return;
    }

    if (!hasAnyTransaction) {
      toast.error("Registre a primeira transacao antes de concluir o onboarding.");
      setActiveStepId("first_transaction");
      return;
    }

    const nextUser = await persistProgress(
      (current) => ({
        ...current,
        completedSteps: [...current.completedSteps, "result"],
        skippedSteps: current.skippedSteps.filter((step) => step !== "result"),
      }),
      { hasAccount: hasAnyAccount, hasTransaction: hasAnyTransaction },
    );

    if (nextUser?.hasCompletedOnboarding) {
      toast.success("Tudo pronto. Sua conta ja esta ativa.");
      navigate(appRoutes.dashboard, { replace: true });
      return;
    }

    toast.error("Ainda nao foi possivel concluir o onboarding com seguranca.");
  };

  const handleDismiss = async () => {
    const nextUser = await persistProgress(
      (current) => ({
        ...current,
        currentStep: activeStep.index,
        dismissed: true,
      }),
      { preserveDismissed: true, preserveCurrentStep: true },
    );

    if (nextUser) {
      toast.success("Progresso salvo. Quando voltar, retomaremos deste ponto.");
    }
  };

  return (
    <AppShell
      title="Primeiros passos"
      description="Ative a conta com uma base real: primeira conta, primeira transacao e impacto imediato no dashboard."
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/50 bg-card/85 p-5 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Primeiros passos</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {user?.name ? `${user.name}, vamos mostrar valor logo no primeiro uso` : "Vamos mostrar valor logo no primeiro uso"}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                O objetivo aqui e simples: sair deste fluxo com uma conta criada, uma movimentacao registrada e o dashboard refletindo isso de imediato.
              </p>
            </div>

            {!user?.hasCompletedOnboarding ? (
              <Button variant="ghost" onClick={() => void handleDismiss()} disabled={isSavingProgress}>
                Salvar e retomar depois
              </Button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Passo {activeStep.index + 1} de {steps.length}</span>
                <span>{progressValue}% concluido</span>
              </div>
              <Progress value={progressValue} className="h-2.5 bg-secondary/60" />
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {activeStep.isRecommended ? "Proximo passo recomendado" : "Etapa em andamento"}
              </p>
              <p className="mt-1">{activeStep.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-border/50 bg-card/85 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="space-y-3">
              {steps.map((step) => {
                const Icon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                      step.status === "current"
                        ? "border-primary/40 bg-primary/10"
                        : step.completed
                          ? "border-income/25 bg-income/10"
                          : "border-border/40 bg-secondary/15 hover:bg-secondary/30",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                          step.status === "current"
                            ? "bg-primary text-primary-foreground"
                            : step.completed
                              ? "bg-income text-background"
                              : "bg-background text-primary",
                        )}
                      >
                        {step.completed ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{step.title}</p>
                          {step.completed ? (
                            <span className="rounded-full bg-income/15 px-2 py-0.5 text-[11px] font-medium text-income">
                              Concluido
                            </span>
                          ) : null}
                          {step.isRecommended ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Recomendado
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-3xl border border-border/50 bg-card/85 p-5 shadow-sm backdrop-blur sm:p-8">
            <div className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Etapa atual</p>
                <h2 className="text-2xl font-semibold text-foreground">{activeStep.title}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{activeStep.description}</p>
              </div>
            </div>

            <div className="mt-6">
              {activeStep.id === "welcome" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                    <p className="text-sm text-muted-foreground">Voce vai sair daqui com:</p>
                    <div className="mt-3 space-y-2 text-sm text-foreground">
                      <p>1. Uma conta inicial cadastrada.</p>
                      <p>2. A primeira movimentacao registrada.</p>
                      <p>3. O dashboard com saldo e atividade reais.</p>
                    </div>
                  </div>

                  <Textarea
                    value={welcomeGoal}
                    onChange={(event) => setWelcomeGoal(event.target.value)}
                    placeholder="Objetivo opcional. Ex.: controlar gastos do mes."
                    className="min-h-[96px] rounded-2xl border-border/60 bg-secondary/30"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => void handleWelcomeStep()} disabled={isSavingProgress}>
                      Continuar
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeStep.id === "account" ? (
                <div className="space-y-5">
                  {hasAnyAccount ? (
                    <div className="rounded-2xl border border-income/20 bg-income/10 p-4 text-sm text-foreground">
                      Voce ja possui ao menos uma conta cadastrada. Se quiser, siga direto para a primeira transacao.
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Select
                      value={accountForm.accountType}
                      onValueChange={(value: StarterAccountType) =>
                        setAccountForm((current) => ({
                          ...current,
                          accountType: value,
                          name: current.name || (value === "cash" ? "Carteira" : "Conta principal"),
                          color:
                            value === "cash" || !hasManualAccountColorSelection
                              ? getSuggestedAccountColor(current.name, value)
                              : current.color,
                        }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30">
                        <SelectValue placeholder="Tipo da conta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_account">Conta bancaria</SelectItem>
                        <SelectItem value="cash">Caixa / Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      value={accountForm.name}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          name: event.target.value,
                          color: hasManualAccountColorSelection
                            ? current.color
                            : getSuggestedAccountColor(event.target.value, current.accountType),
                        }))
                      }
                      placeholder="Ex.: Conta principal"
                      className="h-11 rounded-xl border-border/60 bg-secondary/30"
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="onboarding-account-balance">
                        Saldo atual da conta
                      </label>
                      <Input
                        id="onboarding-account-balance"
                        value={accountForm.currentBalance}
                        onChange={(event) => setAccountForm((current) => ({ ...current, currentBalance: event.target.value }))}
                        placeholder="Ex.: 1500,00"
                        inputMode="decimal"
                        className="h-11 rounded-xl border-border/60 bg-secondary/30"
                      />
                      <p className="text-xs text-muted-foreground">
                        Informe quanto ja existe nessa conta agora. Esse valor sera usado como base do saldo no dashboard.
                      </p>
                    </div>
                    <ColorField
                      label="Cor da conta"
                      value={accountForm.color}
                      onChange={(nextColor) => {
                        setHasManualAccountColorSelection(true);
                        setAccountForm((current) => ({ ...current, color: nextColor }));
                      }}
                      presets={ACCOUNT_COLOR_PRESETS}
                      inputAriaLabel="Selecionar cor da conta inicial"
                      fallback={getSuggestedAccountColor(accountForm.name, accountForm.accountType)}
                    />
                  </div>

                  <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    {accountForm.accountType === "cash"
                      ? "Use caixa para dinheiro fisico ou reserva fora do banco."
                      : "Use conta bancaria para conta corrente, poupanca ou conta digital."}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => void handleAccountStep()} disabled={createBankConnection.isPending || isSavingProgress}>
                      {createBankConnection.isPending ? "Salvando..." : hasAnyAccount ? "Criar outra conta e continuar" : "Salvar e continuar"}
                    </Button>
                    <Button variant="outline" onClick={goBack} disabled={activeStep.index === 0}>
                      <ChevronLeft size={16} />
                      Voltar
                    </Button>
                    {hasAnyAccount ? (
                      <Button variant="outline" onClick={() => setActiveStepId("first_transaction")}>
                        Usar conta existente
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeStep.id === "first_transaction" ? (
                <div className="space-y-5">
                  {!hasAnyAccount ? (
                    <>
                      <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 text-sm text-muted-foreground">
                        Crie uma conta primeiro para associar a sua primeira movimentacao.
                      </div>
                      <Button onClick={() => setActiveStepId("account")}>Ir para conta</Button>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Select
                          value={transactionForm.transactionType}
                          onValueChange={(value: TransactionType) =>
                            setTransactionForm((current) => ({
                              ...current,
                              transactionType: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30">
                            <SelectValue placeholder="Tipo da movimentacao" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Despesa</SelectItem>
                            <SelectItem value="income">Receita</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={transactionForm.bankConnectionId}
                          onValueChange={(value) => setTransactionForm((current) => ({ ...current, bankConnectionId: value }))}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30">
                            <SelectValue placeholder="Conta de origem" />
                          </SelectTrigger>
                          <SelectContent>
                            {transactionAccounts.map((bank) => (
                              <SelectItem key={bank.id} value={String(bank.id)}>
                                {bank.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Input
                          value={transactionForm.description}
                          onChange={(event) =>
                            setTransactionForm((current) => ({ ...current, description: event.target.value }))
                          }
                          placeholder={transactionForm.transactionType === "income" ? "Ex.: Salario" : "Ex.: Mercado"}
                          className="h-11 rounded-xl border-border/60 bg-secondary/30"
                        />

                        <Input
                          value={transactionForm.amount}
                          onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))}
                          placeholder="Valor"
                          inputMode="decimal"
                          className="h-11 rounded-xl border-border/60 bg-secondary/30"
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Input
                          type="date"
                          value={transactionForm.occurredOn}
                          onChange={(event) =>
                            setTransactionForm((current) => ({ ...current, occurredOn: event.target.value }))
                          }
                          className="h-11 rounded-xl border-border/60 bg-secondary/30"
                        />

                        <Select
                          value={transactionForm.categoryId}
                          onValueChange={(value) => setTransactionForm((current) => ({ ...current, categoryId: value }))}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30">
                            <SelectValue placeholder="Categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.map((category) => (
                              <SelectItem key={category.id} value={String(category.id)}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                        {transactionForm.transactionType === "income"
                          ? "Receitas aumentam o saldo total e ajudam a mostrar entradas no dashboard."
                          : "Despesas mostram imediatamente a saida no dashboard e no resumo de gastos."}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button onClick={() => void handleFirstTransactionStep()} disabled={createTransaction.isPending || isSavingProgress}>
                          {createTransaction.isPending ? "Salvando..." : "Salvar e continuar"}
                        </Button>
                        <Button variant="outline" onClick={goBack} disabled={activeStep.index === 0}>
                          <ChevronLeft size={16} />
                          Voltar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {activeStep.id === "result" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                      <p className="text-sm text-muted-foreground">Conta inicial</p>
                      <p className="mt-2 font-semibold text-foreground">{hasAnyAccount ? "Criada" : "Pendente"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                      <p className="text-sm text-muted-foreground">Primeira transacao</p>
                      <p className="mt-2 font-semibold text-foreground">{hasAnyTransaction ? "Registrada" : "Pendente"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                      <p className="text-sm text-muted-foreground">Saldo atualizado</p>
                      <p className="mt-2 font-semibold text-foreground">
                        {isDashboardLoading ? "Carregando..." : balanceCard?.formattedValue ?? "--"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-income/20 bg-income/10 p-4">
                    <p className="font-semibold text-foreground">Tudo pronto. Sua conta ja esta ativa.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasAnyTransaction
                        ? "Seu saldo ja foi atualizado com a primeira movimentacao. Agora voce pode acompanhar tudo no dashboard."
                        : "Finalize a primeira movimentacao para ver o resumo completo com dados reais."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                    <p className="text-sm text-muted-foreground">Ultima movimentacao registrada</p>
                    <p className="mt-2 font-semibold text-foreground">
                      {latestTransaction ? latestTransaction.description : "Nenhuma movimentacao encontrada ainda"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {latestTransaction
                        ? `${latestTransaction.formattedAmount} em ${latestTransaction.relativeDate}`
                        : "Assim que a primeira transacao for criada, o resumo aparece aqui."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => void handleResultStep()} disabled={isSavingProgress}>
                      Abrir dashboard
                    </Button>
                    <Button variant="outline" onClick={goBack} disabled={activeStep.index === 0}>
                      <ChevronLeft size={16} />
                      Voltar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
