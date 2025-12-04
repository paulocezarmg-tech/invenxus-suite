import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, DollarSign, AlertTriangle, TrendingUp, Package, Clock, Save } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { Separator } from "@/components/ui/separator";

export const ReportSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();
  
  const [config, setConfig] = useState({
    incluir_financeiro: true,
    incluir_estoque_critico: true,
    incluir_previsoes: true,
    incluir_valor_estoque: true,
    horario_envio: "08:00:00",
  });

  // Buscar configurações existentes
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["report-config"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("relatorio_configuracoes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setConfig({
          incluir_financeiro: data.incluir_financeiro,
          incluir_estoque_critico: data.incluir_estoque_critico,
          incluir_previsoes: data.incluir_previsoes,
          incluir_valor_estoque: data.incluir_valor_estoque,
          horario_envio: data.horario_envio,
        });
      }

      return data;
    },
  });

  // Salvar configurações
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Usuário não autenticado");

      const configData = {
        user_id: user.id,
        organization_id: organizationId,
        ...config,
      };

      if (existingConfig) {
        const { error } = await supabase
          .from("relatorio_configuracoes")
          .update(config)
          .eq("user_id", user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("relatorio_configuracoes")
          .insert(configData);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-config"] });
      toast({
        title: "Configurações salvas",
        description: "Suas preferências de relatório foram atualizadas.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Relatórios Diários</CardTitle>
            <CardDescription>
              Personalize quais informações você deseja receber no relatório diário por email
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Content Options */}
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-foreground mb-3">Conteúdo do Relatório</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="financeiro" className="font-medium cursor-pointer">Resumo Financeiro</Label>
                  <p className="text-sm text-muted-foreground">
                    Vendas, compras e saldo do dia anterior
                  </p>
                </div>
              </div>
              <Switch
                id="financeiro"
                checked={config.incluir_financeiro}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, incluir_financeiro: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="estoque-critico" className="font-medium cursor-pointer">Produtos Críticos</Label>
                  <p className="text-sm text-muted-foreground">
                    Produtos abaixo do estoque mínimo
                  </p>
                </div>
              </div>
              <Switch
                id="estoque-critico"
                checked={config.incluir_estoque_critico}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, incluir_estoque_critico: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="previsoes" className="font-medium cursor-pointer">Previsão de Estoque (IA)</Label>
                  <p className="text-sm text-muted-foreground">
                    Produtos em risco de ruptura nos próximos 7 dias
                  </p>
                </div>
              </div>
              <Switch
                id="previsoes"
                checked={config.incluir_previsoes}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, incluir_previsoes: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Package className="h-4 w-4 text-warning" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="valor-estoque" className="font-medium cursor-pointer">Valor Total em Estoque</Label>
                  <p className="text-sm text-muted-foreground">
                    Valor total de produtos em estoque
                  </p>
                </div>
              </div>
              <Switch
                id="valor-estoque"
                checked={config.incluir_valor_estoque}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, incluir_valor_estoque: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Schedule */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Agendamento</h3>
          <div className="p-4 rounded-lg border border-border/50 bg-background/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="horario" className="font-medium">Horário de Envio</Label>
                <p className="text-sm text-muted-foreground">
                  Horário em que o relatório será enviado diariamente
                </p>
              </div>
            </div>
            <Select
              value={config.horario_envio}
              onValueChange={(value) =>
                setConfig({ ...config, horario_envio: value })
              }
            >
              <SelectTrigger id="horario" className="w-full max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="06:00:00">06:00</SelectItem>
                <SelectItem value="07:00:00">07:00</SelectItem>
                <SelectItem value="08:00:00">08:00</SelectItem>
                <SelectItem value="09:00:00">09:00</SelectItem>
                <SelectItem value="10:00:00">10:00</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
