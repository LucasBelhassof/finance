import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Bell, CalendarDays, ChevronDown, CreditCard, Search, Settings2, Trash2 } from "lucide-react";

import AppShell from "@/components/AppShell";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { useInvoices, useUpdateInvoiceSettings } from "@/hooks/use-invoices";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import { useCategories, useDeleteTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { getCurrentMonthSelection, resolveMonthYearRange } from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";
import type { InvoiceItem, InvoiceSettingsInput, InvoiceStatus, InvoiceTransactionItem } from "@/types/api";

const FILTER_QUERY_PARAM_KEYS = {
  cardId: "cardId",
  status: "status",
  categoryId: "categoryId",
  search: "search",
} as const;

const statusOptions: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Aberta" },
  { value: "closed", label: "Fechada" },
  { value: "due_soon", label: "Vence em breve" },
  { value: "overdue", label: "Atrasada" },
];

function updateUrlFilterParams(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  updates: Record<string, string | null>,
) {
  const nextSearchParams = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === "") {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, value);
    }
  });

  setSearchParams(nextSearchParams, { replace: true });
}

function formatDate(value: string) {
  if (!value) {
    return "--";
  }

  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString("pt-BR");
}

function getStatusLabel(status: InvoiceStatus) {
  return statusOptions.find((item) => item.value === status)?.label ?? "Aberta";
}

function getStatusBadgeClassName(status: InvoiceStatus) {
  if (status === "overdue") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (status === "due_soon") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  if (status === "closed") {
    return "border-info/30 bg-info/10 text-info";
  }

  return "border-primary/30 bg-primary/10 text-primary";
}

function SettingsForm({ invoice, onSave, isSaving }: { invoice: InvoiceItem; onSave: (input: InvoiceSettingsInput) => void; isSaving: boolean }) {
  const [statementCloseDay, setStatementCloseDay] = useState(String(invoice.card.statementCloseDay ?? ""));
  const [statementDueDay, setStatementDueDay] = useState(String(invoice.card.statementDueDay ?? ""));
  const [notifyInvoiceClosed, setNotifyInvoiceClosed] = useState(invoice.card.notifyInvoiceClosed);
  const [notifyInvoiceDueSoon, setNotifyInvoiceDueSoon] = useState(invoice.card.notifyInvoiceDueSoon);
  const [invoiceDueReminderDays, setInvoiceDueReminderDays] = useState(String(invoice.card.invoiceDueReminderDays ?? 3));

  const handleSave = () => {
    const closeDay = Number(statementCloseDay);
    const dueDay = Number(statementDueDay);
    const reminderDays = Number(invoiceDueReminderDays);

    if (!Number.isInteger(closeDay) || closeDay < 1 || closeDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      toast.error("Informe dias de fechamento e vencimento entre 1 e 31.");
      return;
    }

    if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 15) {
      toast.error("Informe um lembrete entre 1 e 15 dias.");
      return;
    }

    onSave({
      cardId: invoice.card.id,
      statementCloseDay: closeDay,
      statementDueDay: dueDay,
      notifyInvoiceClosed,
      notifyInvoiceDueSoon,
      invoiceDueReminderDays: reminderDays,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={statementCloseDay}
          onChange={(event) => setStatementCloseDay(event.target.value)}
          placeholder="Dia de fechamento"
          inputMode="numeric"
          className="h-11 rounded-xl border-border/60 bg-secondary/35"
        />
        <Input
          value={statementDueDay}
          onChange={(event) => setStatementDueDay(event.target.value)}
          placeholder="Dia de vencimento"
          inputMode="numeric"
          className="h-11 rounded-xl border-border/60 bg-secondary/35"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 text-sm text-foreground">
            <span>Notificar fatura fechada</span>
            <Switch checked={notifyInvoiceClosed} onCheckedChange={setNotifyInvoiceClosed} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm text-foreground">
            <span>Notificar vencimento próximo</span>
            <Switch checked={notifyInvoiceDueSoon} onCheckedChange={setNotifyInvoiceDueSoon} />
          </label>
          <Input
            value={invoiceDueReminderDays}
            onChange={(event) => setInvoiceDueReminderDays(event.target.value)}
            placeholder="Dias antes do vencimento"
            inputMode="numeric"
            className="h-11 rounded-xl border-border/60 bg-background/60"
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar ajustes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function CreditCardInvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSelection = useMemo(() => getCurrentMonthSelection(), []);
  const defaultDateRange = useMemo(
    () => resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year),
    [currentSelection.monthIndex, currentSelection.year],
  );
  const {
    selectedMonthIndex,
    selectedYear,
    datePreset,
    dateRange,
    handleMonthChange,
    handleYearChange,
    handlePresetChange,
    handleCustomRangeApply,
  } = useUrlPeriodFilter({
    selectedMonthIndex: currentSelection.monthIndex,
    selectedYear: currentSelection.year,
    datePreset: "month",
    dateRange: defaultDateRange,
  });

  const selectedCardId = searchParams.get(FILTER_QUERY_PARAM_KEYS.cardId)?.trim() || "all";
  const selectedCategoryId = searchParams.get(FILTER_QUERY_PARAM_KEYS.categoryId)?.trim() || "all";
  const statusParam = searchParams.get(FILTER_QUERY_PARAM_KEYS.status);
  const selectedStatus = statusOptions.some((item) => item.value === statusParam) ? (statusParam as InvoiceStatus | "all") : "all";
  const search = searchParams.get(FILTER_QUERY_PARAM_KEYS.search) ?? "";
  const filters = useMemo(
    () => ({
      cardId: selectedCardId,
      referenceStart: dateRange.startDate,
      referenceEnd: dateRange.endDate,
      status: selectedStatus,
      categoryId: selectedCategoryId,
      search,
    }),
    [dateRange.endDate, dateRange.startDate, search, selectedCardId, selectedCategoryId, selectedStatus],
  );
  const { data, isLoading, isError, refetch } = useInvoices(filters);
  const { data: categories = [] } = useCategories();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const updateSettings = useUpdateInvoiceSettings();
  const [openInvoiceIds, setOpenInvoiceIds] = useState<Set<string>>(new Set());
  const [settingsInvoice, setSettingsInvoice] = useState<InvoiceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceTransactionItem | null>(null);
  const invoices = data?.invoices ?? [];
  const expenseCategories = categories.filter((category) => category.transactionType === "expense");

  const handleResetFilters = () => {
    const nextSearchParams = new URLSearchParams(searchParams);

    nextSearchParams.set("month", String(currentSelection.monthIndex));
    nextSearchParams.set("year", String(currentSelection.year));
    nextSearchParams.set("preset", "month");
    nextSearchParams.set("startDate", defaultDateRange.startDate);
    nextSearchParams.set("endDate", defaultDateRange.endDate);
    Object.values(FILTER_QUERY_PARAM_KEYS).forEach((key) => nextSearchParams.delete(key));
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleCategoryChange = async (transaction: InvoiceTransactionItem, categoryId: string) => {
    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        description: transaction.description,
        amount: transaction.amount,
        occurredOn: transaction.occurredOn,
        bankConnectionId: transaction.account.id,
        categoryId,
        isRecurring: transaction.isRecurring,
      });
      toast.success("Categoria atualizada.");
    } catch (error) {
      toast.error("Não foi possível atualizar a categoria.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteTransaction.mutateAsync({
        id: deleteTarget.id,
        occurredOn: deleteTarget.occurredOn,
      });
      setDeleteTarget(null);
      toast.success("Despesa removida.");
    } catch (error) {
      toast.error("Não foi possível remover a despesa.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const headerContent = (
    <section data-tour-id="invoices-filters" className="glass-card rounded-[28px] border border-border/40 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <TransactionsMonthYearFilter
          selectedMonthIndex={selectedMonthIndex}
          selectedYear={selectedYear}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
        />

        <TransactionsDateFilter
          preset={datePreset}
          range={dateRange}
          onSelectPreset={handlePresetChange}
          onApplyCustomRange={handleCustomRangeApply}
          showPresetButtons={false}
        />

        <Select
          value={selectedCardId}
          onValueChange={(value) =>
            updateUrlFilterParams(searchParams, setSearchParams, {
              [FILTER_QUERY_PARAM_KEYS.cardId]: value === "all" ? null : value,
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
            <SelectValue placeholder="Todos os cartões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {(data?.filterOptions.cards ?? []).map((card) => (
              <SelectItem key={card.id} value={String(card.id)}>
                {card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedStatus}
          onValueChange={(value) =>
            updateUrlFilterParams(searchParams, setSearchParams, {
              [FILTER_QUERY_PARAM_KEYS.status]: value === "all" ? null : value,
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedCategoryId}
          onValueChange={(value) =>
            updateUrlFilterParams(searchParams, setSearchParams, {
              [FILTER_QUERY_PARAM_KEYS.categoryId]: value === "all" ? null : value,
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(data?.filterOptions.categories ?? []).map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full xl:max-w-sm xl:flex-1">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) =>
              updateUrlFilterParams(searchParams, setSearchParams, {
                [FILTER_QUERY_PARAM_KEYS.search]: event.target.value.trim() || null,
              })
            }
            placeholder="Buscar despesa, cartão ou categoria..."
            className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
          />
        </div>

        <Button variant="ghost" className="h-11 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={handleResetFilters}>
          Limpar filtros
        </Button>
      </div>
    </section>
  );

  return (
    <AppShell
      title="Faturas"
      description="Acompanhe fechamento, vencimento e despesas dos cartões de crédito."
      headerContent={headerContent}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="glass-card p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
            </div>
          ))
        ) : (
          <>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Total filtrado</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data?.summary.formattedTotalAmount ?? "R$ 0,00"}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Vencendo</p>
              <p className="mt-1 text-2xl font-bold text-warning">{data?.summary.dueSoonCount ?? 0}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Atrasadas</p>
              <p className="mt-1 text-2xl font-bold text-destructive">{data?.summary.overdueCount ?? 0}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Cartões ativos</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data?.summary.activeCardsCount ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {isError ? (
        <div className="glass-card rounded-2xl border border-destructive/20 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 text-destructive" size={20} />
              <div>
                <h2 className="font-semibold text-foreground">Não foi possível carregar as faturas</h2>
                <p className="text-sm text-muted-foreground">Tente novamente em instantes.</p>
              </div>
            </div>
            <Button onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && invoices.length === 0 ? (
        <div className="glass-card rounded-2xl border border-border/40 p-6 text-sm text-muted-foreground">
          Nenhuma fatura encontrada para os filtros selecionados.
        </div>
      ) : null}

      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="glass-card rounded-2xl border border-border/40 p-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-4 h-16 w-full" />
              </div>
            ))
          : invoices.map((invoice) => {
              const isOpen = openInvoiceIds.has(invoice.id);

              return (
                <Collapsible
                  key={invoice.id}
                  open={isOpen}
                  onOpenChange={(open) =>
                    setOpenInvoiceIds((current) => {
                      const next = new Set(current);
                      if (open) {
                        next.add(invoice.id);
                      } else {
                        next.delete(invoice.id);
                      }
                      return next;
                    })
                  }
                  className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground", invoice.card.color)}>
                        <CreditCard size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">{invoice.card.name}</h2>
                          <Badge variant="outline" className={getStatusBadgeClassName(invoice.status)}>
                            {getStatusLabel(invoice.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {invoice.referenceMonthLabel} · {formatDate(invoice.periodStart)} a {formatDate(invoice.periodEnd)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1">
                            <CalendarDays size={13} />
                            Fecha {formatDate(invoice.closingDate)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1">
                            <Bell size={13} />
                            Vence {formatDate(invoice.dueDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="text-2xl font-bold text-foreground">{invoice.formattedTotalAmount}</p>
                        <p className="text-xs text-muted-foreground">{invoice.transactionCount} despesa(s)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setSettingsInvoice(invoice)} aria-label="Ajustar fatura">
                          <Settings2 size={16} />
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            Detalhes
                            <ChevronDown size={16} className={cn("transition-transform", isOpen && "rotate-180")} />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="mt-5 border-t border-border/40 pt-4">
                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                        <div className="rounded-xl bg-secondary/35 p-3">
                          <p className="text-xs text-muted-foreground">Período</p>
                          <p className="mt-1 font-medium text-foreground">
                            {formatDate(invoice.periodStart)} a {formatDate(invoice.periodEnd)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-secondary/35 p-3">
                          <p className="text-xs text-muted-foreground">Fechamento</p>
                          <p className="mt-1 font-medium text-foreground">Dia {invoice.card.statementCloseDay ?? "--"}</p>
                        </div>
                        <div className="rounded-xl bg-secondary/35 p-3">
                          <p className="text-xs text-muted-foreground">Vencimento</p>
                          <p className="mt-1 font-medium text-foreground">Dia {invoice.card.statementDueDay ?? "--"}</p>
                        </div>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-xl border border-border/40">
                        <div className="hidden grid-cols-[120px_minmax(0,1fr)_220px_140px_52px] gap-3 bg-secondary/40 px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground lg:grid">
                          <span>Data</span>
                          <span>Despesa</span>
                          <span>Categoria</span>
                          <span className="text-right">Valor</span>
                          <span />
                        </div>
                        <div className="divide-y divide-border/40">
                          {invoice.transactions.map((transaction) => (
                            <div key={transaction.id} className="grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[120px_minmax(0,1fr)_220px_140px_52px] lg:items-center">
                              <span className="text-sm text-muted-foreground">{formatDate(transaction.occurredOn)}</span>
                              <div className="min-w-0">
                                <p className="break-words text-sm font-medium text-foreground">{transaction.description}</p>
                                {transaction.isInstallment && transaction.installmentNumber && transaction.installmentCount ? (
                                  <p className="text-xs text-muted-foreground">
                                    Parcela {transaction.installmentNumber}/{transaction.installmentCount}
                                  </p>
                                ) : null}
                              </div>
                              <Select
                                value={String(transaction.category.id)}
                                onValueChange={(value) => void handleCategoryChange(transaction, value)}
                                disabled={updateTransaction.isPending}
                              >
                                <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/35">
                                  <SelectValue placeholder="Categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.map((category) => (
                                    <SelectItem key={category.id} value={String(category.id)}>
                                      {category.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-left text-sm font-semibold text-destructive lg:text-right">
                                {transaction.formattedAmount}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="justify-self-end text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleteTarget(transaction)}
                                aria-label="Excluir despesa"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
      </div>

      <Dialog open={Boolean(settingsInvoice)} onOpenChange={(open) => !open && setSettingsInvoice(null)}>
        <DialogContent className="max-w-[520px] border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Ajustar fatura</DialogTitle>
            <DialogDescription>{settingsInvoice ? settingsInvoice.card.name : "Cartão"}</DialogDescription>
          </DialogHeader>
          {settingsInvoice ? (
            <SettingsForm
              key={settingsInvoice.id}
              invoice={settingsInvoice}
              isSaving={updateSettings.isPending}
              onSave={async (input) => {
                try {
                  await updateSettings.mutateAsync(input);
                  setSettingsInvoice(null);
                  toast.success("Ajustes da fatura salvos.");
                } catch (error) {
                  toast.error("Não foi possível salvar os ajustes.", {
                    description: error instanceof Error ? error.message : "Tente novamente em instantes.",
                  });
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              A despesa será removida das transações e a fatura será recalculada automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTransaction.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTransaction.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteTransaction();
              }}
            >
              {deleteTransaction.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
