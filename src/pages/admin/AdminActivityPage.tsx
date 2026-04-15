import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminActivity } from "@/hooks/use-admin";

export default function AdminActivityPage() {
  const { data } = useAdminActivity();

  return (
    <AdminLayout title="Atividade" description="Eventos recentes de autenticacao e acessos administrativos auditados.">
      <Card>
        <CardHeader>
          <CardTitle>Ultimos eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.events ?? []).map((event) => (
            <div key={String(event.id)} className="flex flex-col gap-2 rounded-lg border border-border/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{event.eventType}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString("pt-BR")}
                  {event.user ? ` • ${event.user.name} (${event.user.role})` : ""}
                  {event.email ? ` • ${event.email}` : ""}
                </p>
              </div>
              <Badge variant={event.success ? "default" : "destructive"}>{event.success ? "success" : "failure"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
