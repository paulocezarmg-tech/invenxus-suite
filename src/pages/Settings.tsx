import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesSettings } from "@/components/settings/CategoriesSettings";
import { LocationsSettings } from "@/components/settings/LocationsSettings";
import { SuppliersSettings } from "@/components/settings/SuppliersSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";
import { InvitesSettings } from "@/components/settings/InvitesSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { ReportSettings } from "@/components/settings/ReportSettings";
import { Users, UserPlus, User, FileText, Settings as SettingsIcon, FolderOpen, MapPin, Building2 } from "lucide-react";

const Settings = () => {
  const [userRole, setUserRole] = useState<string | null>(null);

  // Check user role
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ["current-user-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (roles && roles.length > 0) {
        // Priority order: superadmin > admin > almoxarife > auditor > operador
        const rolePriority: Record<string, number> = {
          superadmin: 5,
          admin: 4,
          almoxarife: 3,
          auditor: 2,
          operador: 1,
        };

        // Get the highest priority role
        const highestRole = roles.reduce((highest, current) => {
          const currentPriority = rolePriority[current.role] || 0;
          const highestPriority = rolePriority[highest.role] || 0;
          return currentPriority > highestPriority ? current : highest;
        });

        setUserRole(highestRole.role);
      }
      return user;
    },
  });

  // Always default to profile to avoid permission errors
  const defaultTab = "profile";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="p-6 md:p-8 space-y-6 md:space-y-8 animate-fade-in">
        {/* Header Premium */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
            <SettingsIcon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Configurações</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Gerencie sua conta e preferências do sistema
            </p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full space-y-6">
          <div className="overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0">
            <TabsList className="inline-flex h-auto items-center justify-start gap-1 md:gap-2 rounded-2xl bg-card/80 backdrop-blur-sm p-1.5 border-0 shadow-card min-w-max">
              <TabsTrigger 
                value="profile"
                className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Meu Perfil</span>
                <span className="sm:hidden">Perfil</span>
              </TabsTrigger>
              <TabsTrigger 
                value="reports"
                className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
              >
                <FileText className="h-4 w-4" />
                <span>Relatórios</span>
              </TabsTrigger>
              {userRole !== "operador" && (
                <>
                  <TabsTrigger 
                    value="users" 
                    className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
                  >
                    <Users className="h-4 w-4" />
                    <span>Usuários</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="invites"
                    className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Convites</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="categories" 
                    className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>Categorias</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="locations" 
                    className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>Locais</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="suppliers" 
                    className="inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Fornecedores</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <TabsContent value="profile" className="mt-0">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <ReportSettings />
          </TabsContent>

          {userRole !== "operador" && (
            <>
              <TabsContent value="users" className="mt-0">
                <UsersSettings />
              </TabsContent>

              <TabsContent value="invites" className="mt-0">
                <InvitesSettings />
              </TabsContent>

              <TabsContent value="categories" className="mt-0">
                <CategoriesSettings />
              </TabsContent>

              <TabsContent value="locations" className="mt-0">
                <LocationsSettings />
              </TabsContent>

              <TabsContent value="suppliers" className="mt-0">
                <SuppliersSettings />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
