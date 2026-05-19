import type { LucideIcon } from "lucide-react";
import { Building2, FolderKanban, LayoutDashboard, Layers3, MessageSquare, PiggyBank, Shield } from "lucide-react";
import { matchPath } from "react-router-dom";

import { appRoutes } from "@/lib/routes";

type BaseNavItem = {
  label: string;
  to: string;
};

export type AppNavItem = BaseNavItem & {
  icon: LucideIcon;
  end?: boolean;
};

export const navItems: AppNavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", to: appRoutes.dashboard, end: true },
];

export const secondaryNavItems: AppNavItem[] = [
  { icon: MessageSquare, label: "Chat IA", to: appRoutes.chat },
  { icon: FolderKanban, label: "Planejamentos", to: appRoutes.plans },
  { icon: PiggyBank, label: "Caixinhas", to: appRoutes.savingsGoal },
  { icon: Building2, label: "Contas", to: appRoutes.accounts },
];

export const expenseManagementItems: BaseNavItem[] = [
  { label: "Transações", to: appRoutes.transactions },
  { label: "Receitas recorrentes", to: appRoutes.expenseManagementRecurringIncome },
  { label: "Faturas", to: appRoutes.expenseManagementInvoices },
  { label: "Habitação", to: appRoutes.expenseManagementHousing },
  { label: "Parcelamentos", to: appRoutes.expenseManagementInstallments },
  { label: "Métricas", to: appRoutes.expenseManagementMetrics },
];

export const adminItems: BaseNavItem[] = [
  { label: "Visão geral", to: appRoutes.adminOverview },
  { label: "Usuários", to: appRoutes.adminUsers },
  { label: "Financeiro", to: appRoutes.adminFinancialMetrics },
  { label: "IA", to: appRoutes.adminAiUsage },
  { label: "Assinaturas", to: appRoutes.adminSubscriptions },
  { label: "Atividade", to: appRoutes.adminActivity },
  { label: "Notificações", to: appRoutes.adminNotifications },
];

export const mobilePrimaryNavItems: AppNavItem[] = [
  navItems[0],
  { icon: Layers3, label: "Transações", to: appRoutes.transactions },
  { icon: MessageSquare, label: "Chat", to: appRoutes.chat },
  { icon: FolderKanban, label: "Planos", to: appRoutes.plans },
];

export function isNavItemActive(pathname: string, item: Pick<AppNavItem, "to" | "end">) {
  if (item.end) {
    return pathname === item.to;
  }

  return Boolean(matchPath({ path: `${item.to}/*`, end: false }, pathname) || pathname === item.to);
}

export function isSubItemActive(pathname: string, item: BaseNavItem) {
  return pathname === item.to;
}

export function isExpenseManagementActive(pathname: string) {
  return Boolean(
    pathname === appRoutes.transactions ||
    matchPath({ path: `${appRoutes.expenseManagement}/*`, end: false }, pathname),
  );
}

export function isAdminActive(pathname: string) {
  return Boolean(pathname === appRoutes.admin || matchPath({ path: `${appRoutes.admin}/*`, end: false }, pathname));
}

export function isMoreSectionActive(pathname: string) {
  return !mobilePrimaryNavItems.some((item) => isNavItemActive(pathname, item));
}
