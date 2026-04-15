import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  SkipForward,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { useBanks, useCreateBankConnection, useUpdateBankConnection } from "@/hooks/use-banks";
import { ACCOUNT_COLOR_PRESETS, getSuggestedAccountColor } from "@/lib/account-colors";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import * as authService from "@/modules/auth/services/auth-service";
import type { AuthOnboardingProgress, OnboardingStepId } from "@/modules/auth/types/auth-types";
import type { CreateBankConnectionInput, UpdateBankConnectionInput } from "@/types/api";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

type StarterAccountType = "bank_account" | "cash";
type StepStatus = "completed" | "current" | "upcoming" | "skipped";

type StarterForm = {
  name: string;
  accountType: StarterAccountType;
  currentBalance: string;
  color: string;
};

type BillingForm = {
  cardId: string;
  statementCloseDay: string;
  statementDueDay: string;
};

const STEP_DEFS: Array<{
  id: OnboardingStepId;
  title: string;
  description: string;
  hint?: string;
  icon: typeof UserCircle2;
}> = [
  {
    id: "profile",
    title: "Completar perfil",
    description: "Revise seus dados e confira os atalhos principais da conta.",
    icon: UserCircle2,
  },
  {
    id: "account",
    title: "Adicionar conta ou cartao",
    description: "Cadastre sua primeira conta para comecar a organizar saldo e lancamentos.",
    icon: Wallet,
  },
  {
    id: "due_dates",
    title: "Configurar vencimentos",
    description: "Se voce usa cartao, informe fechamento e vencimento para organizar as proximas faturas.",
    hint: "Sem cartao agora? Pule esta etapa e volte depois.",
    icon: CreditCard,
  },
  {
    id: "dashboard",
    title: "Visualizar dashboard",
    description: "Abra o painel inicial e veja onde acompanhar saldo, entradas e saidas.",
    icon: LayoutDashboard,
  },
];

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function uniqueSteps(steps: OnboardingStepId[]) {
  return STEP_DEFS.map((step) => step.id).filter((stepId) => steps.includes(stepId));
}

function normalizeProgress(progress?: AuthOnboardingProgress | null): AuthOnboardingProgress {
  return {
    currentStep: Math.max(0, Math.min(STEP_DEFS.length - 1, progress?.currentStep ?? 0)),
    completedSteps: uniqueSteps(progress?.completedSteps ?? []),
    skippedSteps: uniqueSteps(progress?.skippedSteps ?? []),
    dismissed: Boolean(progress?.dismissed),
  };
}

function getDefaultAccountForm(accountType: StarterAccountType = "bank_account"): StarterForm {
  return {
    name: "",
    accountType,
    currentBalance: "0,00",
    color: getSuggestedAccountColor("", accountType),
  };
}

function getDefaultBillingForm(): BillingForm {
  return {
    cardId: "",
    statementCloseDay: "",
    statementDueDay: "",
  };
}

function getRecommendedStepIndex(progress: AuthOnboardingProgress, hasAccount: boolean, hasDueDates: boolean) {
  const states: Record<OnboardingStepId, boolean> = {
    profile: progress.completedSteps.includes("profile"),
    account: progress.completedSteps.includes("account") || hasAccount,
    due_dates: progress.completedSteps.includes("due_dates") || hasDueDates,
    dashboard: progress.completedSteps.includes("dashboard"),
  };

  const nextIndex = STEP_DEFS.findIndex((step) => !states[step.id] && !progress.skippedSteps.includes(step.id));
  return nextIndex === -1 ? STEP_DEFS.length - 1 : nextIndex;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, setUserState } = useAuthSession();
  const { data: banks = [] } = useBanks(Boolean(user));
  const createBankConnection = useCreateBankConnection();
  const updateBankConnection = useUpdateBankConnection();

  const [accountForm, setAccountForm] = useState<StarterForm>(getDefaultAccountForm());
  const [billingForm, setBillingForm] = useState<BillingForm>(getDefaultBillingForm());
  const [activeStepId, setActiveStepId] = useState<OnboardingStepId>("profile");
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [hasManualAccountColorSelection, setHasManualAccountColorSelection] = useState(false);

  const onboardingProgress = useMemo(() => normalizeProgress(user?.onboardingProgress), [user?.onboardingProgress]);
  const creditCards = useMemo(() => banks.filter((bank) => bank.accountType === "credit_card"), [banks]);
  const hasAnyAccount = banks.length > 0;
  const hasConfiguredDueDates = creditCards.some((card) => card.statementCloseDay && card.statementDueDay);
  const recommendedStepIndex = getRecommendedStepIndex(onboardingProgress, hasAnyAccount, hasConfiguredDueDates);
  const recommendedStepId = STEP_DEFS[recommendedStepIndex]?.id ?? "dashboard";

  const steps = STEP_DEFS.map((step, index) => {
    const completed =
      step.id === "account"
        ? onboardingProgress.completedSteps.includes(step.id) || hasAnyAccount
        : step.id === "due_dates"
          ? onboardingProgress.completedSteps.includes(step.id) || hasConfiguredDueDates
          : step.id === "dashboard"
            ? onboardingProgress.completedSteps.includes(step.id) || user?.hasCompletedOnboarding === true
            : onboardingProgress.completedSteps.includes(step.id);
    const skipped = onboardingProgress.skippedSteps.includes(step.id) && !completed;

    let status: StepStatus = "upcoming";

    if (completed) {
      status = "completed";
    } else if (skipped) {
      status = "skipped";
    } else if (step.id === activeStepId) {
      status = "current";
    }

    return {
      ...step,
      index,
      completed,
      skipped,
      status,
      isRecommended: step.id === recommendedStepId && !completed && !skipped,
    };
  });

  const activeStep = steps.find((step) => step.id === activeStepId) ?? steps[recommendedStepIndex];
  const progressValue = Math.round((steps.filter((step) => step.completed || step.skipped).length / steps.length) * 100);
  const selectedCard = creditCards.find((card) => String(card.id) === billingForm.cardId) ?? creditCards[0] ?? null;

  const goToNextStep = () => {
    const nextPendingStep = steps.slice(activeStep.index + 1).find((step) => !step.completed && !step.skipped);
    const nextSequentialStep = steps[activeStep.index + 1];
    const nextStep = nextPendingStep ?? nextSequentialStep ?? steps[steps.length - 1];

    if (nextStep) {
      setActiveStepId(nextStep.id);
    }
  };

  useEffect(() => {
    const persistedStepId = STEP_DEFS[onboardingProgress.currentStep]?.id ?? recommendedStepId;
    setActiveStepId(persistedStepId);
  }, [onboardingProgress.currentStep, recommendedStepId]);

  useEffect(() => {
    const currentStep = steps.find((step) => step.id === activeStepId);

    if (!currentStep) {
      setActiveStepId(recommendedStepId);
    }
  }, [activeStepId, recommendedStepId, steps]);

  useEffect(() => {
    if (!selectedCard) {
      setBillingForm(getDefaultBillingForm());
      return;
    }

    setBillingForm((current) => {
      if (current.cardId === String(selectedCard.id)) {
        return current;
      }

      return {
        cardId: String(selectedCard.id),
        statementCloseDay: selectedCard.statementCloseDay ? String(selectedCard.statementCloseDay) : "",
        statementDueDay: selectedCard.statementDueDay ? String(selectedCard.statementDueDay) : "",
      };
    });
  }, [selectedCard]);

  const persistProgress = async (
    transform: (current: AuthOnboardingProgress) => AuthOnboardingProgress,
    options?: {
      hasAccount?: boolean;
      hasDueDates?: boolean;
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
            options?.hasDueDates ?? hasConfiguredDueDates,
          );

      const response = await authService.updateOnboardingProgress(sanitized);
      setUserState(response.user);
      setActiveStepId(STEP_DEFS[sanitized.currentStep]?.id ?? "dashboard");
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

  const handleProfileStep = async () => {
    const nextUser = await persistProgress((current) => ({
      ...current,
      completedSteps: [...current.completedSteps, "profile"],
      skippedSteps: current.skippedSteps.filter((step) => step !== "profile"),
    }));

    if (nextUser) {
      navigate(appRoutes.profile);
    }
  };

  const handleAccountStep = async () => {
    const currentBalance = parseCurrencyInput(accountForm.currentBalance);

    if (!accountForm.name.trim() || !Number.isFinite(currentBalance)) {
      toast.error("Informe um nome e um saldo inicial validos.");
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

      toast.success("Conta criada. Vamos para o proximo passo.");
      setAccountForm(getDefaultAccountForm());
      setHasManualAccountColorSelection(false);
    } catch (error) {
      toast.error("Nao foi possivel criar sua conta.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDueDatesStep = async () => {
    if (!selectedCard) {
      await handleSkipDueDates();
      return;
    }

    const statementCloseDay = Number(billingForm.statementCloseDay);
    const statementDueDay = Number(billingForm.statementDueDay);

    if (
      !Number.isInteger(statementCloseDay) ||
      !Number.isInteger(statementDueDay) ||
      statementCloseDay < 1 ||
      statementCloseDay > 31 ||
      statementDueDay < 1 ||
      statementDueDay > 31
    ) {
      toast.error("Informe dias validos entre 1 e 31.");
      return;
    }

    try {
      await updateBankConnection.mutateAsync({
        id: selectedCard.id,
        name: selectedCard.name,
        accountType: selectedCard.accountType,
        currentBalance: selectedCard.currentBalance,
        creditLimit: selectedCard.creditLimit,
        color: selectedCard.color,
        connected: selectedCard.connected,
        parentBankConnectionId: selectedCard.parentBankConnectionId,
        statementCloseDay,
        statementDueDay,
      } satisfies UpdateBankConnectionInput);

      await persistProgress(
        (current) => ({
          ...current,
          completedSteps: [...current.completedSteps, "due_dates"],
          skippedSteps: current.skippedSteps.filter((step) => step !== "due_dates"),
        }),
        { hasDueDates: true },
      );

      toast.success("Vencimentos salvos.");
    } catch (error) {
      toast.error("Nao foi possivel salvar os vencimentos.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleSkipDueDates = async () => {
    const nextUser = await persistProgress((current) => ({
      ...current,
      skippedSteps: [...current.skippedSteps, "due_dates"],
      completedSteps: current.completedSteps.filter((step) => step !== "due_dates"),
    }));

    if (nextUser) {
      toast.success("Etapa pulada. Voce pode configurar isso depois.");
    }
  };

  const handleDashboardStep = async () => {
    const nextUser = await persistProgress(
      (current) => ({
        ...current,
        completedSteps: [...current.completedSteps, "dashboard"],
        skippedSteps: current.skippedSteps.filter((step) => step !== "dashboard"),
      }),
      { hasAccount: hasAnyAccount, hasDueDates: hasConfiguredDueDates },
    );

    if (nextUser) {
      toast.success("Primeiros passos concluidos.");
      navigate(appRoutes.dashboard, { replace: true });
    }
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
      navigate(appRoutes.dashboard, { replace: true });
    }
  };

  const goBack = () => {
    const previous = steps[activeStep.index - 1];
    if (previous) {
      setActiveStepId(previous.id);
    }
  };

  return (
    <AppShell
      title="Primeiros passos"
      description="Complete no seu ritmo. O dashboard continua liberado enquanto voce configura a conta."
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-border/50 bg-card/85 p-5 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Primeiros passos</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {user?.name ? `${user.name}, vamos ativar sua conta` : "Vamos ativar sua conta"}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                Siga este passo a passo para configurar o basico do produto. Voce pode entrar no dashboard a qualquer momento.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              {!user?.hasCompletedOnboarding ? (
                <Button variant="ghost" onClick={() => void handleDismiss()} disabled={isSavingProgress}>
                  <SkipForward size={16} />
                  Pular e retomar depois
                </Button>
              ) : null}
            </div>
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
                          : step.skipped
                            ? "border-border/50 bg-secondary/30"
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
                              : step.skipped
                                ? "bg-secondary text-muted-foreground"
                                : "bg-background text-primary",
                        )}
                      >
                        {step.completed ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{step.title}</p>
                          {step.completed ? <span className="rounded-full bg-income/15 px-2 py-0.5 text-[11px] font-medium text-income">Concluido</span> : null}
                          {!step.completed && step.skipped ? <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Pulado</span> : null}
                          {step.isRecommended ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Recomendado</span> : null}
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

              {activeStep.hint ? (
                <div className="rounded-2xl border border-border/40 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground sm:max-w-sm">
                  {activeStep.hint}
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              {activeStep.id === "profile" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                    <p className="text-sm text-muted-foreground">Confira estes pontos antes de seguir:</p>
                    <div className="mt-3 space-y-2 text-sm text-foreground">
                      <p>1. Nome e e-mail corretos.</p>
                      <p>2. Atalhos de conta e configuracoes acessiveis.</p>
                      <p>3. Base pronta para o primeiro uso.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => void handleProfileStep()} disabled={isSavingProgress}>Abrir perfil</Button>
                    <Button variant="outline" onClick={goToNextStep}>Continuar no onboarding</Button>
                  </div>
                </div>
              ) : null}

              {activeStep.id === "account" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Select
                      value={accountForm.accountType}
                      onValueChange={(value: StarterAccountType) =>
                        setAccountForm((current) => ({
                          ...current,
                          accountType: value,
                          color: value === "cash" || !hasManualAccountColorSelection ? getSuggestedAccountColor(current.name, value) : current.color,
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
                          color: hasManualAccountColorSelection ? current.color : getSuggestedAccountColor(event.target.value, current.accountType),
                        }))
                      }
                      placeholder="Ex.: Nubank, Itau, Carteira"
                      className="h-11 rounded-xl border-border/60 bg-secondary/30"
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <Input
                      value={accountForm.currentBalance}
                      onChange={(event) => setAccountForm((current) => ({ ...current, currentBalance: event.target.value }))}
                      placeholder="Saldo inicial"
                      inputMode="decimal"
                      className="h-11 rounded-xl border-border/60 bg-secondary/30"
                    />
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
                      : "Use conta bancaria para saldo de conta corrente, poupanca ou conta digital."}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => void handleAccountStep()} disabled={createBankConnection.isPending || isSavingProgress}>
                      {createBankConnection.isPending ? "Salvando..." : "Salvar e continuar"}
                    </Button>
                    <Button variant="outline" onClick={goBack} disabled={activeStep.index === 0}>
                      <ChevronLeft size={16} />
                      Voltar
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeStep.id === "due_dates" ? (
                <div className="space-y-5">
                  {creditCards.length ? (
                    <>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <Select
                          value={billingForm.cardId}
                          onValueChange={(value) => {
                            const nextCard = creditCards.find((card) => String(card.id) === value);
                            setBillingForm({
                              cardId: value,
                              statementCloseDay: nextCard?.statementCloseDay ? String(nextCard.statementCloseDay) : "",
                              statementDueDay: nextCard?.statementDueDay ? String(nextCard.statementDueDay) : "",
                            });
                          }}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30">
                            <SelectValue placeholder="Selecione o cartao" />
                          </SelectTrigger>
                          <SelectContent>
                            {creditCards.map((card) => (
                              <SelectItem key={card.id} value={String(card.id)}>
                                {card.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          value={billingForm.statementCloseDay}
                          onChange={(event) => setBillingForm((current) => ({ ...current, statementCloseDay: event.target.value }))}
                          placeholder="Dia de fechamento"
                          inputMode="numeric"
                          className="h-11 rounded-xl border-border/60 bg-secondary/30"
                        />

                        <Input
                          value={billingForm.statementDueDay}
                          onChange={(event) => setBillingForm((current) => ({ ...current, statementDueDay: event.target.value }))}
                          placeholder="Dia de vencimento"
                          inputMode="numeric"
                          className="h-11 rounded-xl border-border/60 bg-secondary/30"
                        />
                      </div>

                      <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                        Esses dias ajudam a organizar o cartao desde o primeiro mes de uso.
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button onClick={() => void handleDueDatesStep()} disabled={updateBankConnection.isPending || isSavingProgress}>
                          {updateBankConnection.isPending ? "Salvando..." : "Salvar vencimentos"}
                        </Button>
                        <Button variant="outline" onClick={() => void handleSkipDueDates()} disabled={isSavingProgress}>
                          Pular por agora
                        </Button>
                        <Button variant="outline" onClick={() => navigate(appRoutes.accounts)}>
                          Ir para contas
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 text-sm text-muted-foreground">
                        Voce ainda nao tem cartao cadastrado. Pule esta etapa agora e volte quando adicionar um cartao.
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button onClick={() => void handleSkipDueDates()} disabled={isSavingProgress}>Pular por agora</Button>
                        <Button variant="outline" onClick={() => navigate(appRoutes.accounts)}>Ir para contas</Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {activeStep.id === "dashboard" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                      <p className="text-sm text-muted-foreground">Perfil</p>
                      <p className="mt-2 font-semibold text-foreground">{steps.find((step) => step.id === "profile")?.completed ? "Pronto" : "Pendente"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                      <p className="text-sm text-muted-foreground">Conta inicial</p>
                      <p className="mt-2 font-semibold text-foreground">{steps.find((step) => step.id === "account")?.completed ? "Pronta" : "Pendente"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                      <p className="text-sm text-muted-foreground">Vencimentos</p>
                      <p className="mt-2 font-semibold text-foreground">
                        {steps.find((step) => step.id === "due_dates")?.completed
                          ? "Prontos"
                          : steps.find((step) => step.id === "due_dates")?.skipped
                            ? "Pulado"
                            : "Pendente"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
                    O dashboard fica sempre liberado. Use esta etapa para encerrar o onboarding quando quiser.
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => void handleDashboardStep()} disabled={isSavingProgress}>
                      Concluir e abrir dashboard
                    </Button>
                    <Button variant="outline" onClick={() => navigate(appRoutes.dashboard)}>
                      Ir para o dashboard agora
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
