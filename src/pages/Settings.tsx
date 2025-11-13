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
import { Users, UserPlus, User } from "lucide-react";

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
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        <Tabs defaultValue={defaultTab} className="w-full space-y-8">
          <TabsList className="inline-flex h-12 items-center justify-start gap-2 rounded-lg bg-card p-1 border-0 shadow-card">
            <TabsTrigger 
              value="profile"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <User className="h-4 w-4" />
              Meu Perfil
            </TabsTrigger>
            {userRole !== "operador" && (
              <>
                <TabsTrigger 
                  value="users" 
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Users className="h-4 w-4" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger 
                  value="invites"
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <UserPlus className="h-4 w-4" />
                  Convites
                </TabsTrigger>
                <TabsTrigger value="categories" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Categorias</TabsTrigger>
                <TabsTrigger value="locations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Locais</TabsTrigger>
                <TabsTrigger value="suppliers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Fornecedores</TabsTrigger>
              </>
            )}
          </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettings />
        </TabsContent>

        {userRole !== "operador" && (
          <>
            <TabsContent value="users" className="mt-6">
              <UsersSettings />
            </TabsContent>

            <TabsContent value="invites" className="mt-6">
              <InvitesSettings />
            </TabsContent>

            <TabsContent value="categories" className="mt-6">
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <CategoriesSettings />
              </div>
            </TabsContent>

            <TabsContent value="locations" className="mt-6">
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <LocationsSettings />
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="mt-6">
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <SuppliersSettings />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
      </div>
    </div>
  );
};

export default Settings;
