import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Package, Search, Boxes, PackageCheck, PackageX, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { KitDialog } from "@/components/kits/KitDialog";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";

export default function Kits() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  // Fetch user roles
  useQuery({
    queryKey: ["userRoles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const roles = data?.map(r => r.role) || [];
      setUserRole(roles.length > 0 ? roles[0] : null);
      return roles;
    },
  });

  // Fetch kits with items count
  const { data: kits, isLoading } = useQuery({
    queryKey: ["kits", searchTerm, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("kits")
        .select(`
          *,
          kit_items(count)
        `)
        .eq("organization_id", organizationId)
        .order("name");

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast.success("Kit excluído com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir kit");
    },
  });

  const deleteMultipleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("kits").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      setSelectedIds([]);
      toast.success("Kits excluídos com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir kits");
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este kit?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDeleteMultiple = () => {
    if (confirm(`Tem certeza que deseja excluir ${selectedIds.length} kit(s)?`)) {
      deleteMultipleMutation.mutate(selectedIds);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === kits?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(kits?.map(k => k.id) || []);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleEdit = (kit: any) => {
    setSelectedKit(kit);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedKit(null);
    setIsDialogOpen(true);
  };

  const canManage = userRole === "admin" || userRole === "superadmin" || userRole === "almoxarife";

  // Calculate metrics
  const totalKits = kits?.length || 0;
  const activeKits = kits?.filter(k => k.active)?.length || 0;
  const inactiveKits = kits?.filter(k => !k.active)?.length || 0;
  const totalItems = kits?.reduce((sum, kit) => sum + (kit.kit_items?.[0]?.count || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header Premium */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:justify-between md:items-start p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                  <Boxes className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    Kits de Produtos
                  </h1>
                  <p className="text-base text-muted-foreground">
                    Gerencie combos e pacotes de produtos
                  </p>
                </div>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-3">
                {selectedIds.length > 0 && (
                  <Button 
                    onClick={handleDeleteMultiple} 
                    variant="destructive" 
                    className="h-12 gap-2 rounded-xl shadow-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir ({selectedIds.length})
                  </Button>
                )}
                <Button 
                  onClick={handleAdd} 
                  className="h-12 gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Novo Kit
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Kits</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Boxes className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{totalKits}</div>
              <p className="text-xs text-muted-foreground mt-1">kits cadastrados</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kits Ativos</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center">
                <PackageCheck className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-success">{activeKits}</div>
              <p className="text-xs text-muted-foreground mt-1">disponíveis para venda</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Kits Inativos</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center">
                <PackageX className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-warning">{inactiveKits}</div>
              <p className="text-xs text-muted-foreground mt-1">desativados</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Itens</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">produtos em kits</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="border-0 shadow-card bg-gradient-to-br from-card to-card/80">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-background/50 border-border/50 rounded-xl text-base focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-card overflow-hidden bg-gradient-to-br from-card to-card/80">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Lista de Kits
              </CardTitle>
              <Badge variant="secondary" className="rounded-full px-3">
                {kits?.length || 0} registros
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    {canManage && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === kits?.length && kits?.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead className="font-semibold">SKU</TableHead>
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Descrição</TableHead>
                    <TableHead className="font-semibold">Preço Venda</TableHead>
                    <TableHead className="font-semibold">Itens</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {canManage && <TableHead className="text-right font-semibold">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="h-32">
                        <div className="flex items-center justify-center gap-3">
                          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          <span className="text-muted-foreground">Carregando kits...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : kits && kits.length > 0 ? (
                    kits.map((kit, index) => (
                      <TableRow 
                        key={kit.id} 
                        className="group hover:bg-muted/50 transition-colors"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {canManage && (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(kit.id)}
                              onCheckedChange={() => handleSelectOne(kit.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-sm text-primary">{kit.sku}</TableCell>
                        <TableCell>
                          <div className="font-medium">{kit.name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {kit.description || "-"}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {kit.preco_venda ? formatCurrency(kit.preco_venda) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{kit.kit_items?.[0]?.count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={kit.active ? "default" : "secondary"}
                            className={`rounded-full ${kit.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}
                          >
                            {kit.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary"
                                onClick={() => handleEdit(kit)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(kit.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="h-32">
                        <div className="flex flex-col items-center justify-center gap-3 text-center">
                          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Boxes className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground">Nenhum kit encontrado</p>
                            <p className="text-sm text-muted-foreground/70">Crie seu primeiro kit para começar</p>
                          </div>
                          {canManage && (
                            <Button onClick={handleAdd} variant="outline" className="mt-2 rounded-xl">
                              <Plus className="h-4 w-4 mr-2" />
                              Criar Kit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <KitDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          kit={selectedKit}
        />
      </div>
    </div>
  );
}