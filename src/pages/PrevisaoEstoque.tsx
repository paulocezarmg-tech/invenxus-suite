import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingDown, Package, RefreshCw, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function PrevisaoEstoque() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSendingAlerts, setIsSendingAlerts] = useState(false);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  // Buscar previsões
  const { data: previsoes, isLoading } = useQuery({
    queryKey: ["previsoes-estoque", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsoes_estoque")
        .select(`
          *,
          products:produto_id (
            name,
            sku,
            unit
          )
        `)
        .eq("organization_id", organizationId)
        .order("dias_restantes", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Calcular estatísticas
  const stats = {
    totalProdutos: previsoes?.length || 0,
    produtosCriticos: previsoes?.filter((p) => p.dias_restantes !== null && p.dias_restantes <= 7).length || 0,
    produtosRisco30Dias: previsoes?.filter((p) => p.dias_restantes !== null && p.dias_restantes <= 30).length || 0,
    mediaVendasGeral: previsoes?.reduce((acc, p) => acc + Number(p.media_vendas_diaria), 0) / (previsoes?.length || 1) || 0,
  };

  // Preparar dados do gráfico
  const chartData = previsoes
    ?.filter((p) => p.dias_restantes !== null && p.dias_restantes > 0)
    .slice(0, 10)
    .map((p) => ({
      nome: p.products?.name?.substring(0, 20) || "N/A",
      dias: Math.floor(Number(p.dias_restantes)),
    })) || [];

  const handleCalcularPrevisoes = async () => {
    if (!organizationId) return;

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calcular-previsoes", {
        body: { organization_id: organizationId },
      });

      if (error) throw error;

      toast.success(`Previsões calculadas! ${data.total} produtos analisados.`);
      queryClient.invalidateQueries({ queryKey: ["previsoes-estoque"] });
    } catch (error: any) {
      toast.error("Erro ao calcular previsões: " + error.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleEnviarAlertas = async () => {
    if (!organizationId) return;

    setIsSendingAlerts(true);
    try {
      const { data, error } = await supabase.functions.invoke("enviar-alertas-estoque", {
        body: { organization_id: organizationId, limite_dias: 7 },
      });

      if (error) throw error;

      if (data.alertas_enviados > 0) {
        toast.success(`Alertas enviados para ${data.alertas_enviados} usuário(s)!`);
      } else {
        toast.info("Nenhum produto em situação crítica para alertar.");
      }
    } catch (error: any) {
      toast.error("Erro ao enviar alertas: " + error.message);
    } finally {
      setIsSendingAlerts(false);
    }
  };

  const getDiasBadge = (dias: number | null) => {
    if (dias === null) return <Badge variant="secondary">Sem dados</Badge>;
    
    const diasNum = Math.floor(dias);
    if (diasNum <= 3) return <Badge variant="destructive">{diasNum} dias</Badge>;
    if (diasNum <= 7) return <Badge className="bg-orange-500">{diasNum} dias</Badge>;
    if (diasNum <= 30) return <Badge className="bg-yellow-500">{diasNum} dias</Badge>;
    return <Badge variant="secondary">{diasNum} dias</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📦 Previsão de Estoque com IA</h1>
          <p className="text-muted-foreground mt-2">
            Análise preditiva de estoque com recomendações inteligentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleCalcularPrevisoes}
            disabled={isCalculating}
            className="gap-2"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar Previsões
              </>
            )}
          </Button>
          <Button
            onClick={handleEnviarAlertas}
            disabled={isSendingAlerts}
            variant="outline"
            className="gap-2"
          >
            {isSendingAlerts ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Enviar Alertas
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Analisados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProdutos}</div>
            <p className="text-xs text-muted-foreground">Total de produtos</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Crítico</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.produtosCriticos}</div>
            <p className="text-xs text-muted-foreground">Menos de 7 dias</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risco 30 Dias</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.produtosRisco30Dias}</div>
            <p className="text-xs text-muted-foreground">Acabam em até 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média de Vendas</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mediaVendasGeral.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Unidades/dia (geral)</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dias Restantes por Produto</CardTitle>
            <CardDescription>Top 10 produtos com menor tempo de estoque</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis label={{ value: "Dias", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="dias" fill="hsl(var(--primary))" name="Dias Restantes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Previsões */}
      <Card>
        <CardHeader>
          <CardTitle>Previsões Detalhadas</CardTitle>
          <CardDescription>
            Análise completa com recomendações da IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!previsoes || previsoes.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma previsão disponível</h3>
              <p className="text-muted-foreground mb-4">
                Clique em "Atualizar Previsões" para gerar a análise preditiva
              </p>
              <Button onClick={handleCalcularPrevisoes} disabled={isCalculating}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Primeira Previsão
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Estoque Atual</TableHead>
                  <TableHead className="text-center">Média Diária</TableHead>
                  <TableHead className="text-center">Dias Restantes</TableHead>
                  <TableHead>Recomendação da IA</TableHead>
                  <TableHead className="text-right">Última Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previsoes.map((previsao) => (
                  <TableRow key={previsao.id}>
                    <TableCell className="font-medium">
                      {previsao.products?.name || "N/A"}
                      <div className="text-xs text-muted-foreground">
                        SKU: {previsao.products?.sku || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {Number(previsao.estoque_atual).toFixed(2)} {previsao.products?.unit || "UN"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {Number(previsao.media_vendas_diaria).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getDiasBadge(previsao.dias_restantes)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {previsao.recomendacao}
                      </p>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(previsao.data_previsao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}