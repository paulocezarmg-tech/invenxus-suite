import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingDown, Package, RefreshCw, Mail, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

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
            unit,
            preco_venda,
            cost
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
    perdaPotencialTotal: previsoes?.reduce((acc, p) => acc + Number(p.perda_financeira || 0), 0) || 0,
  };

  // Preparar dados do gráfico com cores dinâmicas
  const chartData = previsoes
    ?.filter((p) => p.dias_restantes !== null && p.dias_restantes > 0)
    .slice(0, 10)
    .map((p) => {
      const dias = Math.floor(Number(p.dias_restantes));
      let cor = "#10b981"; // Verde padrão
      
      if (dias <= 3) {
        cor = "#ef4444"; // Vermelho crítico
      } else if (dias <= 7) {
        cor = "#f59e0b"; // Laranja alerta
      } else if (dias <= 15) {
        cor = "#eab308"; // Amarelo atenção
      }
      
      return {
        nome: p.products?.name || "N/A",
        dias: dias,
        cor: cor,
        produto: p.products?.name || "N/A"
      };
    }) || [];

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
            <CardTitle className="text-sm font-medium">Perda Potencial Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.perdaPotencialTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Estimativa de perda</p>
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
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="nome" 
                  angle={-35} 
                  textAnchor="end" 
                  height={100}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  interval={0}
                />
                <YAxis 
                  label={{ 
                    value: "Dias Restantes", 
                    angle: -90, 
                    position: "insideLeft",
                    style: { fill: 'hsl(var(--foreground))', fontSize: 14, fontWeight: 600 }
                  }}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  labelStyle={{
                    color: 'hsl(var(--popover-foreground))',
                    fontWeight: 600,
                    fontSize: '14px',
                    marginBottom: '4px'
                  }}
                  itemStyle={{
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: '13px'
                  }}
                  formatter={(value: any, name: string, props: any) => {
                    const dias = value as number;
                    let status = "Normal";
                    if (dias <= 3) status = "Crítico 🔴";
                    else if (dias <= 7) status = "Alerta 🟠";
                    else if (dias <= 15) status = "Atenção 🟡";
                    return [`${value} dias (${status})`, "Dias Restantes"];
                  }}
                  labelFormatter={(label) => `Produto: ${label}`}
                />
                <Bar 
                  dataKey="dias" 
                  name="Dias Restantes"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            {/* Legenda customizada */}
            <div className="flex flex-wrap gap-4 justify-center mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                <span>Crítico (≤ 3 dias)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                <span>Alerta (≤ 7 dias)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
                <span>Atenção (≤ 15 dias)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
                <span>Normal (&gt; 15 dias)</span>
              </div>
            </div>
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
                  <TableHead className="text-center">Perda Estimada</TableHead>
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
                    <TableCell className="text-center tabular-nums">
                      {previsao.perda_financeira && Number(previsao.perda_financeira) > 0 ? (
                        <span className="font-medium text-destructive">
                          R$ {Number(previsao.perda_financeira).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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