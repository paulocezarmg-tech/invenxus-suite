import { Home, Package, TrendingUp, FileText, Settings, LogOut, Boxes, Warehouse, Shield, DollarSign, Receipt, Brain, ChevronRight, AlertTriangle } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import stockmasterLogo from "@/assets/stockmaster-logo.png";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/useOrganization";
import { useCallback } from "react";

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!data || data.length === 0) return null;

      const rolePriority: Record<string, number> = {
        superadmin: 5,
        admin: 4,
        almoxarife: 3,
        auditor: 2,
        operador: 1,
      };

      const highestRole = data.reduce((highest, current) => {
        const currentPriority = rolePriority[current.role] || 0;
        const highestPriority = rolePriority[highest.role] || 0;
        return currentPriority > highestPriority ? current : highest;
      });

      return highestRole.role;
    },
  });

  // Prefetch data for pages on hover
  const prefetchPageData = useCallback((url: string) => {
    if (!organizationId) return;

    const prefetchMap: Record<string, () => void> = {
      "/": () => {
        queryClient.prefetchQuery({
          queryKey: ["dashboard-stats", null, null, organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("products")
              .select("id, quantity, cost, min_quantity")
              .eq("organization_id", organizationId);
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/products": () => {
        queryClient.prefetchQuery({
          queryKey: ["products", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("products")
              .select("*, category:categories(name), location:locations(name), supplier:suppliers(name)")
              .eq("active", true)
              .eq("organization_id", organizationId)
              .order("name", { ascending: true });
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/movements": () => {
        queryClient.prefetchQuery({
          queryKey: ["movements", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("movements")
              .select("*, products(name, sku), kits(name, sku), from_location:locations!movements_from_location_id_fkey(name), to_location:locations!movements_to_location_id_fkey(name)")
              .eq("organization_id", organizationId)
              .order("created_at", { ascending: false })
              .limit(100);
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/stock": () => {
        queryClient.prefetchQuery({
          queryKey: ["stock-products", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("products")
              .select("*, category:categories(name), location:locations(name)")
              .eq("active", true)
              .eq("organization_id", organizationId)
              .order("name", { ascending: true });
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/financeiro": () => {
        queryClient.prefetchQuery({
          queryKey: ["financeiro", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("financeiro")
              .select("*, products(name, sku)")
              .eq("organization_id", organizationId)
              .order("data", { ascending: false })
              .limit(100);
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/contas": () => {
        queryClient.prefetchQuery({
          queryKey: ["contas", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("contas")
              .select("*")
              .eq("organization_id", organizationId)
              .order("data_vencimento", { ascending: true });
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/previsao-estoque": () => {
        queryClient.prefetchQuery({
          queryKey: ["previsoes-estoque", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("previsoes_estoque")
              .select("*, products:produto_id(name, sku, unit, preco_venda, cost)")
              .eq("organization_id", organizationId)
              .order("dias_restantes", { ascending: true, nullsFirst: false });
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
      "/kits": () => {
        queryClient.prefetchQuery({
          queryKey: ["kits", organizationId],
          queryFn: async () => {
            const { data } = await supabase
              .from("kits")
              .select("*, kit_items(count)")
              .eq("organization_id", organizationId)
              .order("name", { ascending: true });
            return data;
          },
          staleTime: 1000 * 60 * 2,
        });
      },
    };

    const prefetchFn = prefetchMap[url];
    if (prefetchFn) {
      prefetchFn();
    }
  }, [organizationId, queryClient]);

  const baseMenuItems = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Produtos", url: "/products", icon: Package },
    { title: "Kits", url: "/kits", icon: Boxes },
    { title: "Movimentações", url: "/movements", icon: TrendingUp },
    { title: "Estoque", url: "/stock", icon: Warehouse },
    { title: "Configurações", url: "/settings", icon: Settings },
  ];

  const adminMenuItems = [
    { title: "Financeiro", url: "/financeiro", icon: DollarSign },
    { title: "Contas a Pagar/Receber", url: "/contas", icon: Receipt },
    { title: "Previsão de Estoque", url: "/previsao-estoque", icon: Brain },
    { title: "Estoque Crítico", url: "/estoque-critico", icon: AlertTriangle },
    { title: "Relatórios", url: "/reports", icon: FileText },
  ];

  let menuItems = [...baseMenuItems];
  
  if (userRole === "admin" || userRole === "superadmin") {
    menuItems = [...baseMenuItems.slice(0, 5), ...adminMenuItems, ...baseMenuItems.slice(5)];
  }

  if (userRole === "superadmin") {
    menuItems = [...menuItems, { title: "Administração", url: "/admin", icon: Shield }];
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <Sidebar className="border-r-0 gradient-sidebar">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border/50 p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg" />
            <img
              src={stockmasterLogo}
              alt="StockMaster CMS Logo"
              className={cn(
                "relative object-contain transition-all duration-300",
                collapsed ? "h-10 w-10" : "h-14 w-auto"
              )}
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h2 className="font-bold text-lg text-sidebar-foreground tracking-tight">
                StockMaster
              </h2>
              <span className="text-xs font-medium text-sidebar-foreground/60 tracking-widest uppercase">
                CMS
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-semibold uppercase tracking-widest mb-3 px-3">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        onMouseEnter={() => prefetchPageData(item.url)}
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm",
                          "transition-all duration-200 group",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/25"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0 transition-transform duration-200",
                          !isActive && "group-hover:scale-110"
                        )} />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {isActive && (
                              <ChevronRight className="h-4 w-4 opacity-70" />
                            )}
                          </>
                        )}
                        
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary-foreground rounded-r-full" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            "transition-all duration-200 rounded-lg py-2.5"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="font-medium">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
