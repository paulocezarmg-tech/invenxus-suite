import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Search, Pencil, Trash2, Package, TrendingDown, AlertCircle, DollarSign } from "lucide-react";
import { ProductDialog } from "@/components/products/ProductDialog";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { formatNumber } from "@/lib/formatters";

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  // Check user role - get highest privilege role
  const { data: currentUser, isLoading: isLoadingRole } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (rolesData && rolesData.length > 0) {
        // Determine highest privilege role
        const roleHierarchy = {
          superadmin: 4,
          admin: 3,
          almoxarife: 2,
          auditor: 1,
          operador: 0
        };
        
        const highestRole = rolesData.reduce((highest, current) => {
          const currentLevel = roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
          const highestLevel = roleHierarchy[highest as keyof typeof roleHierarchy] || 0;
          return currentLevel > highestLevel ? current.role : highest;
        }, rolesData[0].role);
        
        console.log("Products - User highest role:", highestRole);
        setUserRole(highestRole);
      }
      return user;
    },
  });

  // Listen for realtime changes to user_roles
  useEffect(() => {
    let channel: any;
    
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;

      channel = supabase
        .channel('user-roles-products')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_roles',
            filter: `user_id=eq.${data.user.id}`
          },
          () => {
            console.log('User roles changed, refetching...');
            queryClient.invalidateQueries({ queryKey: ["current-user"] });
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  // Listen for realtime changes to products
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          console.log('Products changed, refetching...');
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["product-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["product-stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return { total: 0, critical: 0, outOfStock: 0, totalValue: 0 };
      
      const { data, error } = await supabase
        .from("products")
        .select("quantity, min_quantity, cost")
        .eq("organization_id", organizationId);
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const critical = data?.filter(p => p.quantity <= p.min_quantity).length || 0;
      const outOfStock = data?.filter(p => p.quantity === 0).length || 0;
      const totalValue = data?.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0) || 0;
      
      return { total, critical, outOfStock, totalValue };
    },
    enabled: !!organizationId,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", searchTerm, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("products")
        .select(`
          *,
          categories (name),
          locations (name),
          suppliers (name)
        `)
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const getStockBadge = (quantity: number, minQuantity: number) => {
    if (quantity === 0) {
      return <Badge variant="danger">Sem Estoque</Badge>;
    } else if (quantity <= minQuantity) {
      return <Badge variant="warning">Crítico</Badge>;
    } else {
      return <Badge variant="success">Normal</Badge>;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      toast.success("Produto excluído");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir produto");
    }
  };

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-start">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Produtos</h1>
            <p className="text-base text-muted-foreground">
              Gerenciar catálogo de produtos
            </p>
          </div>
          <Button
            className="h-11 gap-2"
            onClick={() => {
              setSelectedProduct(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className={`grid gap-6 ${userRole === "operador" ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total de Produtos</CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight">{stats?.total || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estoque Crítico</CardTitle>
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight text-warning">{stats?.critical || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sem Estoque</CardTitle>
              <div className="h-10 w-10 rounded-full bg-danger/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-danger" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight text-danger">{stats?.outOfStock || 0}</div>
            </CardContent>
          </Card>

          {userRole && userRole !== "operador" && (
            <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valor Total</CardTitle>
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-3xl font-bold tracking-tight text-success">
                  R$ {(stats?.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou código de barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card className="border-0 shadow-card">
        <CardContent className="p-0">
          <div className="rounded-lg overflow-x-auto">
            <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">SKU</TableHead>
              <TableHead className="min-w-[180px]">Nome</TableHead>
              <TableHead className="w-[120px]">Categoria</TableHead>
              <TableHead className="w-[90px]">Qtd.</TableHead>
              <TableHead className="w-[90px]">Mín.</TableHead>
              <TableHead className="min-w-[180px]">Local</TableHead>
              {userRole && userRole !== "operador" && <TableHead className="w-[100px]">Custo</TableHead>}
              <TableHead className="w-[110px]">Status</TableHead>
              {userRole === "superadmin" && <TableHead className="w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={userRole === "superadmin" ? 9 : 8} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : products && products.length > 0 ? (
              products.map((product: any) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="truncate max-w-[120px]" title={product.sku}>
                      {product.sku}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm truncate max-w-[200px]" title={product.name}>
                        {product.name}
                      </div>
                      {product.barcode && (
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={product.barcode}>
                          {product.barcode}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="truncate max-w-[120px]" title={product.categories?.name}>
                      {product.categories?.name || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{formatNumber(Number(product.quantity))}</TableCell>
                  <TableCell className="text-sm">{formatNumber(Number(product.min_quantity))}</TableCell>
                  <TableCell className="text-sm">
                    <div className="max-w-[180px] break-words" title={product.locations?.name}>
                      {product.locations?.name || "N/A"}
                    </div>
                  </TableCell>
                  {userRole && userRole !== "operador" && (
                    <TableCell className="text-sm whitespace-nowrap">R$ {Number(product.cost).toFixed(2)}</TableCell>
                  )}
                  <TableCell>
                    {getStockBadge(Number(product.quantity), Number(product.min_quantity))}
                  </TableCell>
                  {userRole === "superadmin" && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedProduct(product);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
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
                <TableCell colSpan={userRole === "superadmin" ? 9 : 8} className="text-center text-muted-foreground">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
          </div>
        </CardContent>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
      />
      </div>
    </div>
  );
};

export default Products;
