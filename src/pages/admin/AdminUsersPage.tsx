import { useState } from "react";

import AdminLayout from "@/components/admin/AdminLayout";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers, useUpdateAdminUserAccess } from "@/hooks/use-admin";
import type { AdminUsersData } from "@/types/api";

type AdminUser = AdminUsersData["users"][number];

interface PendingRoleChange {
  user: AdminUser;
  nextRole: "user" | "admin";
}

type EditingSurface = "mobile" | "tablet" | "desktop";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function formatUserRole(role: AdminUser["role"]) {
  return role === "admin" ? "admin" : "user";
}

function formatUserPlan(isPremium: boolean) {
  return isPremium ? "premium" : "free";
}

export default function AdminUsersPage() {
  const { data, isLoading } = useAdminUsers();
  const updateAccess = useUpdateAdminUserAccess();

  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null);
  const [editingCell, setEditingCell] = useState<{
    userId: number;
    field: "role" | "plan";
    surface: EditingSurface;
  } | null>(null);

  function handleRoleChange(user: AdminUser, nextRole: "user" | "admin") {
    setEditingCell(null);
    if (nextRole === user.role) return;
    setPendingRole({ user, nextRole });
  }

  function confirmRoleChange() {
    if (!pendingRole) return;
    const { user, nextRole } = pendingRole;
    setPendingRole(null);
    setUpdatingUserId(user.id);
    updateAccess.mutate(
      { userId: user.id, input: { role: nextRole } },
      {
        onSuccess: () => {
          toast.success("Papel atualizado", {
            description: `${user.name} agora e ${nextRole === "admin" ? "administrador" : "usuario"}.`,
          });
        },
        onError: (error) => {
          toast.error("Erro ao atualizar papel", {
            description: getErrorMessage(error, "Tente novamente em instantes."),
          });
        },
        onSettled: () => setUpdatingUserId(null),
      },
    );
  }

  function handlePremiumChange(user: AdminUser, value: string) {
    setEditingCell(null);
    const nextIsPremium = value === "premium";
    if (nextIsPremium === user.isPremium) return;
    setUpdatingUserId(user.id);
    updateAccess.mutate(
      { userId: user.id, input: { isPremium: nextIsPremium } },
      {
        onSuccess: () => {
          toast.success("Plano atualizado", {
            description: `${user.name} agora tem plano ${nextIsPremium ? "premium" : "gratuito"}.`,
          });
        },
        onError: (error) => {
          toast.error("Erro ao atualizar plano", {
            description: getErrorMessage(error, "Tente novamente em instantes."),
          });
        },
        onSettled: () => setUpdatingUserId(null),
      },
    );
  }

  function renderRoleControl(user: AdminUser, isUpdating: boolean, surface: EditingSurface, compact = false) {
    if (isUpdating) {
      return <Badge variant="secondary">Atualizando...</Badge>;
    }

    if (editingCell?.userId === user.id && editingCell.field === "role" && editingCell.surface === surface) {
      return (
        <Select
          defaultOpen
          value={user.role}
          onValueChange={(value) => handleRoleChange(user, value as "user" | "admin")}
          onOpenChange={(open) => {
            if (!open) setEditingCell(null);
          }}
        >
          <SelectTrigger className={compact ? "h-8 w-full text-xs sm:w-28" : "h-7 w-28 text-xs"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user" className="text-xs">
              user
            </SelectItem>
            <SelectItem value="admin" className="text-xs">
              admin
            </SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Badge
        variant={user.role === "admin" ? "default" : "secondary"}
        className="cursor-pointer select-none"
        onClick={() => setEditingCell({ userId: user.id, field: "role", surface })}
      >
        {formatUserRole(user.role)}
      </Badge>
    );
  }

  function renderPlanControl(user: AdminUser, isUpdating: boolean, surface: EditingSurface, compact = false) {
    if (isUpdating) {
      return <Badge variant="secondary">Atualizando...</Badge>;
    }

    if (editingCell?.userId === user.id && editingCell.field === "plan" && editingCell.surface === surface) {
      return (
        <Select
          defaultOpen
          value={user.isPremium ? "premium" : "free"}
          onValueChange={(value) => handlePremiumChange(user, value)}
          onOpenChange={(open) => {
            if (!open) setEditingCell(null);
          }}
        >
          <SelectTrigger className={compact ? "h-8 w-full text-xs sm:w-28" : "h-7 w-28 text-xs"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free" className="text-xs">
              free
            </SelectItem>
            <SelectItem value="premium" className="text-xs">
              premium
            </SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Badge
        variant={user.isPremium ? "default" : "outline"}
        className="cursor-pointer select-none"
        onClick={() => setEditingCell({ userId: user.id, field: "plan", surface })}
      >
        {formatUserPlan(user.isPremium)}
      </Badge>
    );
  }

  return (
    <AdminLayout title="Usuarios" description="Listagem inicial da base com status, papel, premium e ultima sessao.">
      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteracao de papel</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole && (
                <>
                  Voce esta prestes a alterar o papel de <strong>{pendingRole.user.name}</strong> de{" "}
                  <strong>{pendingRole.user.role}</strong> para <strong>{pendingRole.nextRole}</strong>.{" "}
                  {pendingRole.nextRole === "admin"
                    ? "O usuario tera acesso total ao painel administrativo."
                    : "O usuario perdera o acesso ao painel administrativo e todas as sessoes ativas serao encerradas."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Base de usuarios</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="hidden sm:table-cell">Papel</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Plano</TableHead>
                <TableHead className="hidden lg:table-cell">Ultima sessao</TableHead>
                <TableHead className="hidden md:table-cell">Transacoes</TableHead>
                <TableHead className="hidden sm:table-cell">Total liquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.users ?? []).map((user) => {
                const isUpdating = updatingUserId === user.id;

                return (
                  <TableRow key={String(user.id)}>
                    <TableCell className="min-w-0">
                      <div className="min-w-0 space-y-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium">{user.name}</p>
                          <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                        </div>

                        <div className="grid gap-2 text-xs sm:hidden">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <span className="pt-1 text-muted-foreground">Papel</span>
                            <div className="min-w-[7rem] max-w-[9rem] flex-1">
                              {renderRoleControl(user, isUpdating, "mobile", true)}
                            </div>
                          </div>
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <span className="pt-1 text-muted-foreground">Plano</span>
                            <div className="min-w-[7rem] max-w-[9rem] flex-1">
                              {renderPlanControl(user, isUpdating, "mobile", true)}
                            </div>
                          </div>
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <span className="text-muted-foreground">Status</span>
                            <Badge variant="outline">{user.status}</Badge>
                          </div>
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <span className="text-muted-foreground">Transacoes</span>
                            <span className="text-right font-medium">{user.transactionCount}</span>
                          </div>
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <span className="text-muted-foreground">Total liquido</span>
                            <span className="text-right font-medium">{currencyFormatter.format(user.netTotal)}</span>
                          </div>
                        </div>

                        <div className="hidden min-w-0 gap-2 text-xs text-muted-foreground sm:flex md:hidden">
                          <Badge variant="outline">{user.status}</Badge>
                          <span>{user.transactionCount} transacoes</span>
                          <span className="font-medium text-foreground">{currencyFormatter.format(user.netTotal)}</span>
                        </div>

                        <div className="hidden min-w-0 gap-2 text-xs text-muted-foreground md:flex lg:hidden">
                          <span>{user.transactionCount} transacoes</span>
                          <span className="font-medium text-foreground">{currencyFormatter.format(user.netTotal)}</span>
                          <div className="ml-auto min-w-[7rem]">
                            {renderPlanControl(user, isUpdating, "tablet", true)}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground lg:hidden">
                          {user.lastSessionAt ? new Date(user.lastSessionAt).toLocaleString("pt-BR") : "Sem sessao"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell">
                      <div className="min-w-[7rem]">{renderRoleControl(user, isUpdating, "desktop")}</div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{user.status}</Badge>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      <div className="min-w-[7rem]">{renderPlanControl(user, isUpdating, "desktop")}</div>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      <span className="break-words">
                        {user.lastSessionAt ? new Date(user.lastSessionAt).toLocaleString("pt-BR") : "Sem sessao"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{user.transactionCount}</TableCell>
                    <TableCell className="hidden sm:table-cell">{currencyFormatter.format(user.netTotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!isLoading && (data?.users?.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum usuario encontrado para os filtros atuais.</p>
          ) : null}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
