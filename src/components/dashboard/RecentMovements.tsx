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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { useOrganization } from "@/hooks/useOrganization";

export const RecentMovements = () => {
  const { data: organizationId } = useOrganization();
  
  const { data: movements, isLoading } = useQuery({
    queryKey: ["recent-movements", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data: movementsData, error } = await supabase
        .from("movements")
        .select(`
          *,
          products (name, sku),
          kits (name, sku)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Buscar os profiles dos usuários que criaram as movimentações
      const userIds = [...new Set(movementsData?.map(m => m.created_by).filter(Boolean))];
      
      if (userIds.length === 0) return movementsData;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      // Adicionar o nome do profile em cada movimento
      const movementsWithProfiles = movementsData?.map(movement => ({
        ...movement,
        profile_name: profiles?.find(p => p.user_id === movement.created_by)?.name
      }));

      return movementsWithProfiles;
    },
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <ArrowDown className="h-4 w-4 text-green-500" />;
      case "OUT":
        return <ArrowUp className="h-4 w-4 text-red-500" />;
      case "TRANSFER":
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getMovementBadge = (type: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      IN: "default",
      OUT: "destructive",
      TRANSFER: "secondary",
    };

    const labels: Record<string, string> = {
      IN: "Entrada",
      OUT: "Saída",
      TRANSFER: "Transferência",
    };

    return (
      <Badge variant={variants[type] || "default"}>
        {labels[type] || type}
      </Badge>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Movimentações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : movements && movements.length > 0 ? (
              movements.map((movement: any) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getMovementIcon(movement.type)}
                      {getMovementBadge(movement.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {movement.products?.name || movement.kits?.name || "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        SKU: {movement.products?.sku || movement.kits?.sku || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{movement.quantity}</TableCell>
                  <TableCell>{movement.profile_name || "Sistema"}</TableCell>
                  <TableCell>
                    {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Nenhuma movimentação encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
