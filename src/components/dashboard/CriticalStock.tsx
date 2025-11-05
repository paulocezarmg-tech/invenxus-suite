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
import { AlertTriangle } from "lucide-react";
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
      
      // Filter for critical products (quantity <= min_quantity)
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
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Estoque Crítico
          </CardTitle>
          {criticalProducts && criticalProducts.length > 0 && (
            <Badge variant="destructive">{criticalProducts.length} itens</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Qtd. Atual</TableHead>
              <TableHead>Qtd. Mínima</TableHead>
              <TableHead>Local</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : criticalProducts && criticalProducts.length > 0 ? (
              criticalProducts.map((product: any) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.category_name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{product.quantity}</Badge>
                  </TableCell>
                  <TableCell>{product.min_quantity}</TableCell>
                  <TableCell>{product.location_name || "N/A"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum produto em estoque crítico
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
