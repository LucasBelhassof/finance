import { useMemo, useState } from "react";
import { Pie, PieChart, Cell } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BankItem, TransactionItem } from "@/types/api";

interface SpendingChartProps {
  transactions?: TransactionItem[];
  banks?: BankItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function SpendingChartSkeleton() {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold text-foreground">Gastos por Categoria</h3>
      <Skeleton className="mb-5 h-56 w-full rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

const tailwindColorToCss: Record<string, string> = {
  "bg-primary": "hsl(var(--primary))",
  "bg-income": "hsl(var(--income))",
  "bg-expense": "hsl(var(--expense))",
  "bg-info": "hsl(var(--info))",
  "bg-warning": "hsl(var(--warning))",
  "bg-orange-500": "#f97316",
  "bg-purple-500": "#a855f7",
  "bg-red-500": "#ef4444",
  "bg-amber-500": "#f59e0b",
};

function resolveChartColor(colorClass: string) {
  return tailwindColorToCss[colorClass] ?? "hsl(var(--muted-foreground))";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

type SpendingChartItem = {
  slug: string;
  label: string;
  color: string;
  total: number;
  formattedTotal: string;
  percentage: number;
  fill: string;
};

export default function SpendingChart({ transactions = [], banks = [], isLoading, isError }: SpendingChartProps) {
  const [selectedBankId, setSelectedBankId] = useState("all");
  const chartData = useMemo<SpendingChartItem[]>(() => {
    const filteredExpenses = transactions.filter((transaction) => {
      if (transaction.amount >= 0) {
        return false;
      }

      if (selectedBankId === "all") {
        return true;
      }

      return String(transaction.account.id) === selectedBankId;
    });

    const totalExpenses = filteredExpenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const grouped = new Map<string, Omit<SpendingChartItem, "percentage" | "formattedTotal" | "fill">>();

    filteredExpenses.forEach((transaction) => {
      const key = transaction.category.groupSlug || transaction.category.slug;
      const current = grouped.get(key);
      const nextTotal = (current?.total ?? 0) + Math.abs(transaction.amount);

      grouped.set(key, {
        slug: key,
        label: transaction.category.groupLabel || transaction.category.label,
        color: transaction.category.groupColor || "bg-muted-foreground",
        total: nextTotal,
      });
    });

    return Array.from(grouped.values())
      .sort((left, right) => right.total - left.total)
      .map((item) => ({
        ...item,
        formattedTotal: formatCurrency(item.total),
        percentage: totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0,
        fill: resolveChartColor(item.color),
      }));
  }, [selectedBankId, transactions]);

  const chartConfig = chartData.reduce<ChartConfig>((config, item) => {
    config[item.slug] = {
      label: item.label,
      color: item.fill,
    };

    return config;
  }, {});

  if (isLoading) {
    return <SpendingChartSkeleton />;
  }

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground">Gastos por Categoria</h3>
        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
          <SelectTrigger className="h-9 w-[180px] rounded-xl border-border/60 bg-secondary/35 text-xs">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {banks.map((bank) => (
              <SelectItem key={bank.id} value={String(bank.id)}>
                {bank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!chartData.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError
            ? "Nao foi possivel carregar o consolidado por categoria."
            : selectedBankId === "all"
              ? "Ainda nao existem gastos categorizados para exibir."
              : "Nao ha despesas categorizadas para a conta selecionada."}
        </div>
      ) : (
        <>
          <ChartContainer config={chartConfig} className="mb-5 h-56 w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(_, __, item) => {
                      const payload = item.payload as SpendingChartItem;

                      return (
                        <div className="flex min-w-[12rem] items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: payload.fill }} />
                            <span className="text-muted-foreground">{payload.label}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-foreground">{payload.formattedTotal}</div>
                            <div className="text-[11px] text-muted-foreground">{payload.percentage}% do total</div>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="total"
                nameKey="slug"
                innerRadius={54}
                outerRadius={96}
                paddingAngle={3}
                strokeWidth={0}
              >
                {chartData.map((item) => (
                  <Cell key={item.slug} fill={item.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="space-y-3">
            {chartData.map((item) => (
              <div key={item.slug} className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.formattedTotal}</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
