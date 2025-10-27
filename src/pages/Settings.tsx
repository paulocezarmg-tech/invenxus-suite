import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoriesSettings } from "@/components/settings/CategoriesSettings";
import { LocationsSettings } from "@/components/settings/LocationsSettings";
import { SuppliersSettings } from "@/components/settings/SuppliersSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";

const Settings = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerenciar configurações do sistema</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="locations">Locais</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card className="bg-card border-muted">
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>Controle total sobre usuários e permissões</CardDescription>
            </CardHeader>
            <CardContent>
              <UsersSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <Card className="bg-card border-muted">
            <CardHeader>
              <CardTitle>Categorias de Produtos</CardTitle>
              <CardDescription>Gerenciar categorias para organizar produtos</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoriesSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="mt-6">
          <Card className="bg-card border-muted">
            <CardHeader>
              <CardTitle>Locais de Armazenamento</CardTitle>
              <CardDescription>Gerenciar almoxarifados e setores</CardDescription>
            </CardHeader>
            <CardContent>
              <LocationsSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-6">
          <Card className="bg-card border-muted">
            <CardHeader>
              <CardTitle>Fornecedores</CardTitle>
              <CardDescription>Gerenciar informações de fornecedores</CardDescription>
            </CardHeader>
            <CardContent>
              <SuppliersSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
