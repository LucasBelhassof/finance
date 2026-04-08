import { Pie, PieChart, Cell } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { SpendingItem } from "@/types/api";

interface SpendingChartProps {
  spending?: SpendingItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function SpendingChartSkeleton() {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold text-foreground">Gastos por Categoria</h3>
      <Skeleton className="mb-5 h-44 w-full rounded-2xl" />
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

export default function SpendingChart({ spending = [], isLoading, isError }: SpendingChartProps) {
  if (isLoading) {
    return <SpendingChartSkeleton />;
  }

  const chartData = spending.map((item) => ({
    ...item,
    fill: resolveChartColor(item.color),
  }));

  const chartConfig = chartData.reduce<ChartConfig>((config, item) => {
    config[item.slug] = {
      label: item.label,
      color: item.fill,
    };

    return config;
  }, {});

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold text-foreground">Gastos por Categoria</h3>

      {!spending.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError
            ? "Nao foi possivel carregar o consolidado por categoria."
            : "Ainda nao existem gastos categorizados para exibir."}
        </div>
      ) : (
        <>
          <ChartContainer config={chartConfig} className="mb-5 h-44 w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(_, __, item) => {
                      const payload = item.payload as SpendingItem & { fill: string };

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
                innerRadius={44}
                outerRadius={76}
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
