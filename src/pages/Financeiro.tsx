import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, TrendingUp, TrendingDown, Percent, Pencil, Trash2 } from "lucide-react";
import { FinanceiroDialog } from "@/components/financeiro/FinanceiroDialog";
import { MigrateButton } from "@/components/financeiro/MigrateButton";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

export default function Financeiro() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const { toast } = useToast();
  const { userRole, isAdmin, isSuperAdmin, isLoading: isLoadingRole } = useUserRole();

  // Redirect if not admin or superadmin
  if (!isLoadingRole && !isAdmin() && !isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Esta funcionalidade está disponível apenas para administradores.
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const { data: movements, isLoading, refetch } = useQuery({
    queryKey: ["financeiro", filterType, filterProduct, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("financeiro")
        .select(`
          *,
          products (
            id,
            name,
            sku
          )
        `)
        .order("data", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("tipo", filterType);
      }

      if (filterProduct !== "all") {
        // Buscar tanto pelo produto_id quanto pela descrição que contém o nome
        const selectedItem = [...(products || []), ...(kits || [])].find(item => item.id === filterProduct);
        if (selectedItem) {
          query = query.or(`produto_id.eq.${filterProduct},descricao.ilike.%${selectedItem.name}%`);
        }
      }

      if (startDate) {
        query = query.gte("data", startDate);
      }

      if (endDate) {
        query = query.lte("data", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: kits } = useQuery({
    queryKey: ["kits-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits")
        .select("id, name, sku")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Calcular métricas de lucro real
  const totalFaturamento = movements?.reduce((sum, m) => {
    if (m.tipo === "saida") {
      return sum + (parseFloat(m.valor?.toString() || "0"));
    }
    return sum;
  }, 0) || 0;

  const totalCusto = movements?.reduce((sum, m) => {
    return sum + parseFloat(m.custo_total?.toString() || "0");
  }, 0) || 0;

  const lucroLiquido = totalFaturamento - totalCusto;

  const margemLucro = totalFaturamento > 0 ? (lucroLiquido / totalFaturamento) * 100 : 0;

  const handleEdit = (movement: any) => {
    setSelectedMovement(movement);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta movimentação?")) return;

    const { error } = await supabase
      .from("financeiro")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Movimentação excluída",
        description: "A movimentação foi excluída com sucesso.",
      });
      refetch();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Painel de Lucro Real</h1>
          <p className="text-muted-foreground">Controle completo de custos e lucratividade</p>
        </div>
        <div className="flex gap-2">
          <MigrateButton />
          <Button onClick={() => { setSelectedMovement(null); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalFaturamento)}
            </div>
            <p className="text-xs text-muted-foreground">Total de vendas realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(totalCusto)}
            </div>
            <p className="text-xs text-muted-foreground">Custos + despesas operacionais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lucroLiquido >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(lucroLiquido)}
            </div>
            <p className="text-xs text-muted-foreground">Faturamento - custos totais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem de Lucro</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${margemLucro >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {margemLucro.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Percentual de lucro sobre vendas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Compras</SelectItem>
                  <SelectItem value="saida">Vendas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Produto</label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {products && products.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Produtos
                      </div>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {kits && kits.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Kits
                      </div>
                      {kits.map((kit) => (
                        <SelectItem key={kit.id} value={kit.id}>
                          {kit.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle>Movimentações Financeiras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Custos Adic.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : movements?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  movements?.map((movement) => {
                    const product = products?.find(p => p.id === movement.produto_id);
                    const custosAdic = Array.isArray(movement.custos_adicionais) 
                      ? movement.custos_adicionais.reduce((sum: number, c: any) => sum + (c.valor || 0), 0)
                      : 0;

                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="font-medium">
                          {format(new Date(movement.data), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={movement.tipo === "entrada" ? "secondary" : "default"}>
                            {movement.tipo === "entrada" ? "Compra" : "Venda"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{movement.descricao}</div>
                            {product && <div className="text-xs text-muted-foreground">{product.name}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{movement.quantidade || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(parseFloat(movement.preco_venda?.toString() || movement.valor?.toString() || "0"))}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(parseFloat(movement.custo_total?.toString() || "0"))}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={parseFloat(movement.lucro_liquido?.toString() || "0") >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                            {formatCurrency(parseFloat(movement.lucro_liquido?.toString() || "0"))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {custosAdic > 0 ? (
                            <div className="text-xs">
                              <div className="font-medium">{formatCurrency(custosAdic)}</div>
                              {Array.isArray(movement.custos_adicionais) && movement.custos_adicionais.length > 0 && (
                                <div className="text-muted-foreground">
                                  {movement.custos_adicionais.map((c: any) => c.descricao).join(", ")}
                                </div>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(movement)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {(userRole === "admin" || userRole === "superadmin") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(movement.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FinanceiroDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        movement={selectedMovement}
        onSuccess={() => {
          refetch();
          setIsDialogOpen(false);
          setSelectedMovement(null);
        }}
      />
    </div>
  );
}