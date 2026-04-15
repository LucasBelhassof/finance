import { useMemo, useState } from "react";

import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminNotificationTargets, useAdminNotifications, useCreateAdminNotification } from "@/hooks/use-admin";
import type { NotificationCategory } from "@/types/api";
import { toast } from "@/components/ui/sonner";

const categoryOptions: Array<{ value: NotificationCategory; label: string }> = [
  { value: "general", label: "Geral" },
  { value: "invoice_due", label: "Vencimento de fatura" },
  { value: "financing_due", label: "Vencimento de financiamento" },
  { value: "installment_due", label: "Vencimento de parcelamento" },
  { value: "housing_due", label: "Vencimento de moradia" },
  { value: "custom", label: "Personalizado" },
];

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("general");
  const [triggerAt, setTriggerAt] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<Array<number | string>>([]);

  const { data: targets } = useAdminNotificationTargets();
  const { data: notifications, isLoading } = useAdminNotifications();
  const createNotification = useCreateAdminNotification();

  const selectableUsers = useMemo(() => targets?.users ?? [], [targets?.users]);

  const toggleSelectedUser = (userId: number | string, checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, userId]));
      }

      return current.filter((id) => String(id) !== String(userId));
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Informe um titulo e uma mensagem.");
      return;
    }

    if (targetMode === "selected" && selectedUserIds.length === 0) {
      toast.error("Selecione ao menos um usuario.");
      return;
    }

    try {
      const result = await createNotification.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        category,
        triggerAt: triggerAt ? new Date(triggerAt).toISOString() : null,
        target: {
          mode: targetMode,
          userIds: targetMode === "selected" ? selectedUserIds : [],
        },
      });

      toast.success(`Notificacao enviada para ${result.recipientsCount} usuario(s).`);
      setTitle("");
      setMessage("");
      setTriggerAt("");
      setTargetMode("all");
      setSelectedUserIds([]);
    } catch (error) {
      toast.error("Nao foi possivel enviar a notificacao.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AdminLayout title="Notificacoes" description="Envie comunicados para todos os usuarios ou para um grupo especifico.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Nova notificacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notification-title">Titulo</Label>
              <Input
                id="notification-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Manutencao agendada"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-message">Mensagem</Label>
              <Textarea
                id="notification-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva a mensagem que os usuarios vao receber."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as NotificationCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification-trigger-at">Agendar para</Label>
                <Input
                  id="notification-trigger-at"
                  type="datetime-local"
                  value={triggerAt}
                  onChange={(event) => setTriggerAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={targetMode} onValueChange={(value) => setTargetMode(value as "all" | "selected")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os outros usuarios</SelectItem>
                  <SelectItem value="selected">Usuarios selecionados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetMode === "selected" ? (
              <div className="space-y-3 rounded-lg border border-border/60 p-3">
                <p className="text-sm text-muted-foreground">Selecione quem vai receber:</p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {selectableUsers.map((user) => (
                    <label key={String(user.id)} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/40">
                      <Checkbox
                        checked={selectedUserIds.some((id) => String(id) === String(user.id))}
                        onCheckedChange={(checked) => toggleSelectedUser(user.id, checked === true)}
                      />
                      <span className="text-sm text-foreground">{user.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{user.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <Button onClick={() => void handleSubmit()} disabled={createNotification.isPending}>
              {createNotification.isPending ? "Enviando..." : "Enviar notificacao"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historico recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(notifications?.notifications ?? []).map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant="secondary">{item.source === "admin_all" ? "Todos" : "Selecionados"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("pt-BR")} - Lidas: {item.readCount}/{item.recipientsCount}
                </p>
              </div>
            ))}

            {!isLoading && (notifications?.notifications.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma notificacao enviada por enquanto.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
