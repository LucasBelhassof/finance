import { useState } from "react";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useHealth } from "@/hooks/use-health";
import { useCreateSelfNotification, useNotifications } from "@/hooks/use-notifications";
import type { NotificationCategory } from "@/types/api";

const apiUrl = import.meta.env.VITE_API_URL?.trim() || window.location.origin;

function formatServerTime(value?: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export default function SettingsPage() {
  const { data, isLoading, isError } = useHealth();
  const { data: notifications } = useNotifications();
  const createSelfNotification = useCreateSelfNotification();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("general");
  const [triggerAt, setTriggerAt] = useState("");

  const handleCreateSelfAlert = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha titulo e mensagem.");
      return;
    }

    try {
      await createSelfNotification.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        category,
        triggerAt: triggerAt ? new Date(triggerAt).toISOString() : null,
      });

      toast.success("Alerta criado com sucesso.");
      setTitle("");
      setMessage("");
      setCategory("general");
      setTriggerAt("");
    } catch (error) {
      toast.error("Nao foi possivel criar o alerta.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AppShell title="Configuracoes" description="Status da integracao, parametros do ambiente e alertas pessoais">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">API</p>
          <p className="mt-1 break-all text-sm font-medium text-foreground">{apiUrl}</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Backend</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {isLoading ? "..." : data?.status === "ok" ? "Online" : "Indisponivel"}
          </p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Banco</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {isLoading ? "..." : data?.database === "connected" ? "Conectado" : "Indisponivel"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="glass-card p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Criar alerta pessoal</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="self-alert-title">Titulo</Label>
              <Input
                id="self-alert-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Vencimento da fatura Nubank"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="self-alert-message">Mensagem</Label>
              <Textarea
                id="self-alert-message"
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ex.: Pagar fatura ate dia 10 para evitar juros."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as NotificationCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral</SelectItem>
                    <SelectItem value="invoice_due">Vencimento de fatura</SelectItem>
                    <SelectItem value="financing_due">Vencimento de financiamento</SelectItem>
                    <SelectItem value="installment_due">Vencimento de parcelamento</SelectItem>
                    <SelectItem value="housing_due">Vencimento de moradia</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="self-alert-trigger">Data e hora</Label>
                <Input
                  id="self-alert-trigger"
                  type="datetime-local"
                  value={triggerAt}
                  onChange={(event) => setTriggerAt(event.target.value)}
                />
              </div>
            </div>

            <Button onClick={() => void handleCreateSelfAlert()} disabled={createSelfNotification.isPending}>
              {createSelfNotification.isPending ? "Salvando..." : "Criar alerta"}
            </Button>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Suas notificacoes</h2>
          <div className="space-y-3">
            {(notifications?.notifications ?? []).slice(0, 8).map((item) => (
              <div key={String(item.recipientId)} className="rounded-lg bg-secondary/30 p-3">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(item.triggerAt ?? item.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
            {(notifications?.notifications.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Voce ainda nao tem alertas cadastrados.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Diagnostico</h2>

          <div className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 rounded-lg bg-secondary/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Status da API</span>
              <span className="font-medium text-foreground">{data?.status ?? (isLoading ? "Carregando" : "--")}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-secondary/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Conexao com banco</span>
              <span className="font-medium text-foreground">{data?.database ?? (isLoading ? "Carregando" : "--")}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-secondary/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Horario do servidor</span>
              <span className="font-medium text-foreground">{formatServerTime(data?.serverTime)}</span>
            </div>
          </div>

          {isError ? (
            <div className="mt-4 rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
              Nao foi possivel consultar o endpoint de health agora.
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
