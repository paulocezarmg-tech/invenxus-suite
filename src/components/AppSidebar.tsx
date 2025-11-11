import { Home, Package, TrendingUp, FileText, Settings, LogOut, Boxes, Warehouse, Shield, DollarSign } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import stockmasterLogo from "@/assets/stockmaster-logo.png";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

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

      // Priority order: superadmin > admin > almoxarife > auditor > operador
      const rolePriority: Record<string, number> = {
        superadmin: 5,
        admin: 4,
        almoxarife: 3,
        auditor: 2,
        operador: 1,
      };

      // Get the highest priority role
      const highestRole = data.reduce((highest, current) => {
        const currentPriority = rolePriority[current.role] || 0;
        const highestPriority = rolePriority[highest.role] || 0;
        return currentPriority > highestPriority ? current : highest;
      });

      return highestRole.role;
    },
  });

  const baseMenuItems = [{
    title: "Dashboard",
    url: "/",
    icon: Home
  }, {
    title: "Produtos",
    url: "/products",
    icon: Package
  }, {
    title: "Kits",
    url: "/kits",
    icon: Boxes
  }, {
    title: "Movimentações",
    url: "/movements",
    icon: TrendingUp
  }, {
    title: "Financeiro",
    url: "/financeiro",
    icon: DollarSign
  }, {
    title: "Estoque",
    url: "/stock",
    icon: Warehouse
  }, {
    title: "Relatórios",
    url: "/reports",
    icon: FileText
  }, {
    title: "Configurações",
    url: "/settings",
    icon: Settings
  }];

  const menuItems = userRole === "superadmin" 
    ? [...baseMenuItems, { title: "Administração", url: "/admin", icon: Shield }]
    : baseMenuItems;
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Erro ao fazer logout");
    }
  };
  return <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <img src={stockmasterLogo} alt="StockMaster CMS Logo" className={collapsed ? "h-12 w-12 object-contain" : "h-16 w-auto object-contain"} />
          {!collapsed && <div>
              <h2 className="font-semibold text-xl my-0 px-0 mx-0 py-0 text-left">StockMaster</h2>
              <p className="text-muted-foreground text-lg">CMS</p>
            </div>}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={({
                  isActive
                }) => isActive ? "flex items-center gap-3 bg-primary/10 text-primary font-medium" : "flex items-center gap-3 hover:bg-accent/50"}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>;
}