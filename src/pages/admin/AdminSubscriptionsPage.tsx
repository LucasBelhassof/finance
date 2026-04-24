import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminActivity, useAdminSubscriptionMetrics } from "@/hooks/use-admin";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export default function AdminSubscriptionsPage() {
  const { data } = useAdminSubscriptionMetrics();
  const { data: activityData } = useAdminActivity();

  return (
    <AdminLayout title="Assinaturas" description="Panorama de premium, conversao e atividade recente de autenticacao.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários premium</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data?.summary.premiumUsers ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários free</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data?.summary.freeUsers ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversao</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {percentFormatter.format(data?.summary.conversionRate ?? 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR estimado</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{currencyFormatter.format(data?.summary.estimatedMrr ?? 0)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao premium</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.evolution ?? []).map((item) => (
            <div key={item.month} className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
              <span className="font-medium">{item.month}</span>
              <span className="text-sm text-muted-foreground">{item.premiumActivations} ativações</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(activityData?.events ?? []).slice(0, 8).map((event) => (
            <div key={String(event.id)} className="rounded-lg border border-border/60 px-4 py-3">
              <p className="font-medium">{event.eventType}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString("pt-BR")}
                {event.user ? ` • ${event.user.name}` : ""}
                {event.email ? ` • ${event.email}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
