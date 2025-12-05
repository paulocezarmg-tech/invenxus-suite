import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/useOrganization";
import { formatNumber } from "@/lib/formatters";

export default function Stock() {
  const [searchTerm, setSearchTerm] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  // Check user role - get highest privilege role
  const { data: currentUser, isLoading: isLoadingRole } = useQuery({
    queryKey: ["current-user-stock"],
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
        
        console.log("Stock - User highest role:", highestRole);
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
        .channel('user-roles-stock')
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
            queryClient.invalidateQueries({ queryKey: ["current-user-stock"] });
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

  // Fetch products data
  const { data: products, isLoading } = useQuery({
    queryKey: ["stock-products", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(name),
          location:locations(name),
          supplier:suppliers(name)
        `)
        .eq("active", true)
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("stock-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          // Invalidate and refetch products when any change occurs
          queryClient.invalidateQueries({ queryKey: ["stock-products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter products based on search
  const filteredProducts = products?.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate statistics
  const totalProducts = products?.length || 0;
  const criticalStock = products?.filter((p) => p.quantity <= p.min_quantity).length || 0;
  const outOfStock = products?.filter((p) => p.quantity === 0).length || 0;
  const totalValue = products?.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0) || 0;

  const getStockBadge = (quantity: number, minQuantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Sem Estoque</Badge>;
    }
    if (quantity <= minQuantity) {
      return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Crítico</Badge>;
    }
    return <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">Normal</Badge>;
  };

  if (isLoadingRole) {
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
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Estoque em Tempo Real</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Visualize seu estoque atualizado automaticamente
            </p>
          </div>
        </div>

        {/* Statistics Cards Premium */}
        <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total de Produtos</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">itens ativos</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estoque Crítico</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center ring-1 ring-warning/10">
                <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-warning">{criticalStock}</div>
              <p className="text-xs text-muted-foreground">produtos em alerta</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sem Estoque</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 flex items-center justify-center ring-1 ring-danger/10">
                <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-danger" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-danger">{outOfStock}</div>
              <p className="text-xs text-muted-foreground">produtos zerados</p>
            </CardContent>
          </Card>

          {userRole && userRole !== "operador" && (
            <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valor Total</CardTitle>
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center ring-1 ring-success/10">
                  <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-success" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-xl md:text-3xl font-bold tracking-tight text-success">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(totalValue)}
                </div>
                <p className="text-xs text-muted-foreground">em estoque</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search Premium */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, SKU ou código de barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 bg-card/80 backdrop-blur-sm border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Products Table Premium */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg font-semibold">Lista de Produtos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
          {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[80px] font-semibold">SKU</TableHead>
                    <TableHead className="font-semibold">Produto</TableHead>
                    <TableHead className="font-semibold">Categoria</TableHead>
                    <TableHead className="font-semibold">Localização</TableHead>
                    <TableHead className="text-center font-semibold">Quantidade</TableHead>
                    <TableHead className="text-center font-semibold">Qtd. Mínima</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    {userRole && userRole !== "operador" && (
                      <>
                        <TableHead className="text-right font-semibold">Valor Unitário</TableHead>
                        <TableHead className="text-right font-semibold">Valor Total</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts && filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground">{product.category?.name || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{product.location?.name || "-"}</TableCell>
                        <TableCell className="text-center font-semibold tabular-nums">
                          {formatNumber(Number(product.quantity))} {product.unit}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground tabular-nums">
                          {formatNumber(Number(product.min_quantity))} {product.unit}
                        </TableCell>
                        <TableCell>
                          {getStockBadge(Number(product.quantity), Number(product.min_quantity))}
                        </TableCell>
                        {userRole && userRole !== "operador" && (
                          <>
                            <TableCell className="text-right tabular-nums">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(product.cost))}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums text-success">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(product.cost) * Number(product.quantity))}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={userRole && userRole !== "operador" ? 9 : 7} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                          <span>Nenhum produto encontrado</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
