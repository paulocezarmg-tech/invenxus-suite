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
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, DollarSign } from "lucide-react";

interface SupplierPurchaseHistoryProps {
  supplierId: string;
  supplierName: string;
}

export function SupplierPurchaseHistory({ supplierId, supplierName }: SupplierPurchaseHistoryProps) {
  // Fetch products from this supplier
  const { data: products } = useQuery({
    queryKey: ["supplier-products", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("supplier_id", supplierId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch movements for these products (IN only - purchases)
  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ["supplier-movements", supplierId, products],
    queryFn: async () => {
      if (!products || products.length === 0) return [];
      
      const productIds = products.map(p => p.id);
      const { data, error } = await supabase
        .from("movements")
        .select(`
          id,
          type,
          quantity,
          created_at,
          product_id,
          products (
            name,
            sku,
            cost,
            custo_unitario
          )
        `)
        .in("product_id", productIds)
        .eq("type", "IN")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!products && products.length > 0,
  });

  // Calculate statistics
  const totalPurchases = movements?.length || 0;
  const totalQuantity = movements?.reduce((sum, m) => sum + Number(m.quantity), 0) || 0;
  const totalValue = movements?.reduce((sum, m) => {
    const product = m.products as any;
    const cost = product?.custo_unitario || product?.cost || 0;
    return sum + (Number(m.quantity) * Number(cost));
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Compras</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPurchases}</div>
            <p className="text-xs text-muted-foreground">movimentações de entrada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity}</div>
            <p className="text-xs text-muted-foreground">unidades adquiridas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">em compras</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Compras</CardTitle>
          <CardDescription>
            Últimas 50 compras realizadas do fornecedor {supplierName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !movements || movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma compra registrada deste fornecedor
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                    const product = movement.products as any;
                    const cost = product?.custo_unitario || product?.cost || 0;
                    const total = Number(movement.quantity) * Number(cost);

                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">{product?.name || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{product?.sku || "-"}</TableCell>
                        <TableCell className="text-right">{movement.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(cost))}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
