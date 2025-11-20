import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingDown, TrendingUp, ArrowRightLeft, Package, FileText, Clock } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";

interface MovementsReportTableProps {
  dateFrom: Date | null;
  dateTo: Date | null;
}

export const MovementsReportTable = ({ dateFrom, dateTo }: MovementsReportTableProps) => {
  const { data: organizationId } = useOrganization();
  const [selectedTab, setSelectedTab] = useState("all");

  const { data: movements, isLoading } = useQuery({
    queryKey: ["movements-report", dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("movements")
        .select(`
          id,
          created_at,
          type,
          quantity,
          reference,
          note,
          product_id,
          products (id, sku, name, quantity, cost, preco_venda),
          kits (sku, name, preco_venda),
          from_location:locations!movements_from_location_id_fkey (name),
          to_location:locations!movements_to_location_id_fkey (name)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (dateFrom && dateTo) {
        query = query
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Adicionar saldo para cada produto
      const productsMap = new Map();
      
      return data.map((m: any) => {
        let saldo = null;
        if (m.product_id && m.products) {
          if (!productsMap.has(m.product_id)) {
            productsMap.set(m.product_id, m.products.quantity);
          }
          saldo = productsMap.get(m.product_id);
        }
        
        return {
          ...m,
          saldo,
        };
      });
    },
    enabled: !!organizationId,
  });

  // Calcular estatísticas
  const stats = {
    total: movements?.length || 0,
    entradas: movements?.filter(m => m.type === "IN").length || 0,
    saidas: movements?.filter(m => m.type === "OUT").length || 0,
    transferencias: movements?.filter(m => m.type === "TRANSFER").length || 0,
    valorEntradas: movements
      ?.filter(m => m.type === "IN")
      .reduce((acc, m: any) => {
        const cost = m.products?.cost || 0;
        return acc + (cost * Number(m.quantity));
      }, 0) || 0,
    valorSaidas: movements
      ?.filter(m => m.type === "OUT")
      .reduce((acc, m: any) => {
        const price = m.products?.preco_venda || m.kits?.preco_venda || 0;
        return acc + (price * Number(m.quantity));
      }, 0) || 0,
  };

  const filteredMovements = selectedTab === "all" 
    ? movements 
    : movements?.filter(m => {
        if (selectedTab === "in") return m.type === "IN";
        if (selectedTab === "out") return m.type === "OUT";
        if (selectedTab === "transfer") return m.type === "TRANSFER";
        return true;
      });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "IN":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "OUT":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "TRANSFER":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <TrendingUp className="h-4 w-4" />;
      case "OUT":
        return <TrendingDown className="h-4 w-4" />;
      case "TRANSFER":
        return <ArrowRightLeft className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "IN":
        return "Entrada";
      case "OUT":
        return "Saída";
      case "TRANSFER":
        return "Transferência";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Carregando movimentações...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Movimentações</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.entradas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats.valorEntradas)} comprado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.saidas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats.valorSaidas)} vendido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.valorSaidas - stats.valorEntradas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(stats.valorSaidas - stats.valorEntradas)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.transferencias} transferências
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Movimentações</CardTitle>
          <CardDescription>
            Visualização detalhada de todas as movimentações do período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
              <TabsTrigger value="in" className="text-green-600">Entradas ({stats.entradas})</TabsTrigger>
              <TabsTrigger value="out" className="text-red-600">Saídas ({stats.saidas})</TabsTrigger>
              <TabsTrigger value="transfer" className="text-blue-600">Transferências ({stats.transferencias})</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Data/Hora</TableHead>
                      <TableHead className="w-[120px]">Tipo</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center w-[80px]">Qtd</TableHead>
                      <TableHead className="w-[140px]">Local</TableHead>
                      <TableHead className="text-center w-[100px]">Saldo Atual</TableHead>
                      <TableHead className="w-[200px]">Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements && filteredMovements.length > 0 ? (
                      filteredMovements.map((movement: any) => (
                        <TableRow key={movement.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {new Date(movement.created_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getTypeColor(movement.type)} gap-1`}>
                              {getTypeIcon(movement.type)}
                              {getTypeLabel(movement.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {movement.products?.name || movement.kits?.name || "-"}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {movement.quantity}
                          </TableCell>
                          <TableCell className="text-sm">
                            {movement.type === "TRANSFER" ? (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-muted-foreground">{movement.from_location?.name || "-"}</span>
                                <ArrowRightLeft className="h-3 w-3" />
                                <span className="font-medium">{movement.to_location?.name || "-"}</span>
                              </div>
                            ) : movement.type === "IN" ? (
                              <span className="font-medium">{movement.to_location?.name || "-"}</span>
                            ) : (
                              <span className="text-muted-foreground">{movement.from_location?.name || "-"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {movement.saldo !== null ? (
                              <span className="font-semibold text-primary">{movement.saldo}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {movement.note || movement.reference || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma movimentação encontrada no período selecionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
