import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesSettings } from "@/components/settings/CategoriesSettings";
import { LocationsSettings } from "@/components/settings/LocationsSettings";
import { SuppliersSettings } from "@/components/settings/SuppliersSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";
import { Users, UserPlus } from "lucide-react";

const Settings = () => {
  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="inline-flex h-12 items-center justify-start gap-2 rounded-lg bg-card/50 p-1 border border-border">
          <TabsTrigger 
            value="users" 
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 data-[state=active]:bg-success/20 data-[state=active]:text-success"
          >
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger 
            value="invites"
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 data-[state=inactive]:text-muted-foreground"
          >
            <UserPlus className="h-4 w-4" />
            Convites
          </TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="locations">Locais</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UsersSettings />
        </TabsContent>

        <TabsContent value="invites" className="mt-6">
          <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">Funcionalidade de convites em desenvolvimento</p>
          </div>
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
      </Tabs>
    </div>
  );
};

export default Settings;
