import {
  Bell,
  ChevronDown,
  ChevronLeft,
  Layers3,
  Lightbulb,
  LogOut,
  Settings,
  Shield,
  UserCircle2,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { KiplyLogo } from "@/components/brand/KiplyLogo";
import { NavLink } from "@/components/NavLink";
import {
  adminItems,
  expenseManagementItems,
  isAdminActive,
  isExpenseManagementActive,
  isNavItemActive,
  isSubItemActive,
  navItems,
  secondaryNavItems,
} from "@/components/navigation/app-navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "@/components/ui/sonner";
import { appRoutes } from "@/lib/routes";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import { useProductTour } from "@/modules/product-tour/use-product-tour";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const { restartTour } = useProductTour();
  const { isMobile, openMobile, setOpenMobile, state, toggleSidebar } = useSidebar();
  const { user } = useAuthSession();
  const previousPathnameRef = useRef(location.pathname);
  const userName = user?.name ?? "Usuário";
  const userEmail = user?.email ?? "usuario@email.com";
  const isAdmin = user?.role === "admin";
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const isCollapsed = state === "collapsed";
  const expenseManagementActive = isExpenseManagementActive(location.pathname);
  const adminActive = isAdminActive(location.pathname);

  useEffect(() => {
    if (isMobile && openMobile && previousPathnameRef.current !== location.pathname) {
      setOpenMobile(false);
    }
    previousPathnameRef.current = location.pathname;
  }, [isMobile, location.pathname, openMobile, setOpenMobile]);

  return (
    <SidebarRoot collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 overflow-hidden rounded-lg px-2 py-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {isCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg outline-none transition-all hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Expandir sidebar Kiply"
              title="Expandir sidebar Kiply"
            >
              <KiplyLogo variant="icon" className="h-8 w-8" />
            </button>
          ) : (
            <NavLink
              to={appRoutes.dashboard}
              className="flex min-w-0 items-center rounded-lg outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Ir para dashboard Kiply"
              title="Ir para dashboard Kiply"
            >
              <KiplyLogo variant="full" className="h-12 w-auto max-w-[12rem]" />
            </NavLink>
          )}
          {!isCollapsed ? (
            <button
              type="button"
              onClick={isMobile ? () => setOpenMobile(false) : toggleSidebar}
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring md:inline-flex"
              aria-label={isMobile ? "Fechar menu" : "Recolher sidebar"}
              title={isMobile ? "Fechar menu" : "Recolher sidebar"}
            >
              {isMobile ? <X size={16} /> : <ChevronLeft size={16} />}
            </button>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = isNavItemActive(location.pathname, item);

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  data-tour-id={item.to === appRoutes.dashboard ? "nav-dashboard" : undefined}
                  className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <NavLink to={item.to} end={item.end}>
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {isAdmin ? (
            <Collapsible asChild defaultOpen={adminActive}>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={adminActive}
                    tooltip="Administracao"
                    className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  >
                    <Shield size={18} className="shrink-0" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">Admin</span>
                    <ChevronDown
                      size={16}
                      className="ml-auto shrink-0 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/menu-item:rotate-180"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {adminItems.map((item) => {
                      const isActive = isSubItemActive(location.pathname, item);

                      return (
                        <SidebarMenuSubItem key={item.label}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <NavLink to={item.to}>
                              <span>{item.label}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : null}

          <Collapsible asChild defaultOpen={expenseManagementActive}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={expenseManagementActive}
                  tooltip="Gestão Financeira"
                  data-tour-id="nav-expense-management"
                  className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <Layers3 size={18} className="shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Gestão Financeira</span>
                  <ChevronDown
                    size={16}
                    className="ml-auto shrink-0 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/menu-item:rotate-180"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {expenseManagementItems.map((item) => {
                    const isActive = isSubItemActive(location.pathname, item);

                    return (
                      <SidebarMenuSubItem key={item.label}>
                        <SidebarMenuSubButton asChild isActive={isActive}>
                          <NavLink to={item.to}>
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {secondaryNavItems.map((item) => {
            const isActive = isNavItemActive(location.pathname, item);

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild={!item.disabled}
                  isActive={isActive}
                  tooltip={item.label}
                  data-tour-id={
                    item.to === appRoutes.insights
                      ? "nav-insights"
                      : item.to === appRoutes.accounts
                        ? "nav-accounts"
                        : undefined
                  }
                  className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  onClick={
                    item.disabled
                      ? () => {
                          toast.info("Insights desabilitados", {
                            description:
                              "O recurso volta quando a regra de negocio estiver definida. Use o chat financeiro por enquanto.",
                          });
                        }
                      : undefined
                  }
                >
                  {item.disabled ? (
                    <>
                      <item.icon size={18} className="shrink-0" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </>
                  ) : (
                    <NavLink to={item.to}>
                      <item.icon size={18} className="shrink-0" />
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </NavLink>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator className="mx-4 group-data-[collapsible=icon]:mx-2" />

      <SidebarFooter className="p-4 pt-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-col">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg px-2 py-1.5 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                aria-label="Abrir menu de perfil"
                title={isCollapsed ? "Perfil" : undefined}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <span className="text-xs font-medium text-secondary-foreground">{initials || "JD"}</span>
                </div>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isCollapsed ? "right" : "top"}
              align={isCollapsed ? "start" : "end"}
              className="w-56 border-border/60 bg-card text-foreground"
            >
              <DropdownMenuLabel className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                    <span className="text-xs font-medium text-secondary-foreground">{initials || "JD"}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{userName}</p>
                    <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.profile)}>
                <UserCircle2 size={16} />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.notifications)}>
                <Bell size={16} />
                Notificações
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.settings)}>
                <Settings size={16} />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onClick={() => {
                  void restartTour();
                }}
              >
                <Lightbulb size={16} />
                Fazer tour novamente
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem
                className="gap-2 text-destructive hover:bg-destructive hover:text-black focus:bg-destructive focus:text-black"
                disabled={logoutMutation.isPending}
                onClick={async () => {
                  try {
                    await logoutMutation.mutateAsync();
                  } catch (error) {
                    toast.error("Não foi possível encerrar a sessão.", {
                      description: error instanceof Error ? error.message : "Tente novamente em instantes.",
                    });
                  }
                }}
              >
                <LogOut size={16} />
                {logoutMutation.isPending ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}
