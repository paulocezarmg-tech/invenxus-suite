import { useQuery } from "@tanstack/react-query";
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
import { AlertTriangle, Package, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/hooks/useOrganization";

export const CriticalStock = () => {
  const { data: organizationId } = useOrganization();
  
  const { data: criticalProducts, isLoading } = useQuery({
    queryKey: ["critical-stock", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories (name),
          locations (name)
        `)
        .eq("organization_id", organizationId)
        .order("quantity", { ascending: true });

      if (error) throw error;
      
      return data?.filter(p => Number(p.quantity) <= Number(p.min_quantity))
        .slice(0, 10)
        .map(p => ({
          ...p,
          category_name: p.categories?.name,
          location_name: p.locations?.name
        }));
    },
    enabled: !!organizationId,
  });

  return (
    <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Estoque Crítico</CardTitle>
              <p className="text-sm text-muted-foreground">Produtos abaixo do mínimo</p>
            </div>
          </div>
          {criticalProducts && criticalProducts.length > 0 && (
            <Badge variant="destructive" className="text-xs font-semibold px-3 py-1">
              {criticalProducts.length} {criticalProducts.length === 1 ? 'item' : 'itens'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Produto</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">SKU</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Atual</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Mínimo</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Local</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : criticalProducts && criticalProducts.length > 0 ? (
                criticalProducts.map((product: any) => (
                  <TableRow key={product.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          {product.category_name && (
                            <p className="text-xs text-muted-foreground">{product.category_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {product.sku}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="destructive" 
                        className="font-semibold min-w-[40px] justify-center"
                      >
                        {product.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium text-muted-foreground">
                        {product.min_quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {product.location_name || "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                        <Package className="h-6 w-6 text-success" />
                      </div>
                      <p className="text-sm font-medium">Tudo em ordem!</p>
                      <p className="text-xs">Nenhum produto em estoque crítico</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
