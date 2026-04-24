import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminFinancialMetrics } from "@/hooks/use-admin";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormatter = new Intl.NumberFormat("pt-BR");

export default function AdminFinancialMetricsPage() {
  const { data } = useAdminFinancialMetrics();

  return (
    <AdminLayout title="Financeiro" description="Receitas, despesas, volume transacionado e usuários com maior movimento.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{currencyFormatter.format(data?.summary.totalIncome ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{currencyFormatter.format(data?.summary.totalExpenses ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{currencyFormatter.format(data?.summary.aggregateBalance ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transações</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{numberFormatter.format(data?.summary.transactionCount ?? 0)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Serie mensal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.monthlySeries ?? []).map((item) => (
            <div key={item.month} className="grid gap-3 rounded-lg border border-border/60 px-4 py-3 md:grid-cols-4">
              <span className="font-medium">{item.month}</span>
              <span className="text-sm text-muted-foreground">Receitas {currencyFormatter.format(item.income)}</span>
              <span className="text-sm text-muted-foreground">Despesas {currencyFormatter.format(item.expenses)}</span>
              <span className="text-sm text-muted-foreground">{item.transactions} transações</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários com mais transações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Transações</TableHead>
                <TableHead>Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.topUsers ?? []).map((user) => (
                <TableRow key={String(user.id)}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.transactionCount}</TableCell>
                  <TableCell>{currencyFormatter.format(user.transactedVolume)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
