import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

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
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Configurações de Relatórios Diários
        </CardTitle>
        <CardDescription>
          Personalize quais informações você deseja receber no relatório diário por email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="financeiro">Resumo Financeiro</Label>
              <p className="text-sm text-muted-foreground">
                Vendas, compras e saldo do dia anterior
              </p>
            </div>
            <Switch
              id="financeiro"
              checked={config.incluir_financeiro}
              onCheckedChange={(checked) =>
                setConfig({ ...config, incluir_financeiro: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="estoque-critico">Produtos Críticos</Label>
              <p className="text-sm text-muted-foreground">
                Produtos abaixo do estoque mínimo
              </p>
            </div>
            <Switch
              id="estoque-critico"
              checked={config.incluir_estoque_critico}
              onCheckedChange={(checked) =>
                setConfig({ ...config, incluir_estoque_critico: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="previsoes">Previsão de Estoque (IA)</Label>
              <p className="text-sm text-muted-foreground">
                Produtos em risco de ruptura nos próximos 7 dias
              </p>
            </div>
            <Switch
              id="previsoes"
              checked={config.incluir_previsoes}
              onCheckedChange={(checked) =>
                setConfig({ ...config, incluir_previsoes: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="valor-estoque">Valor Total em Estoque</Label>
              <p className="text-sm text-muted-foreground">
                Valor total de produtos em estoque
              </p>
            </div>
            <Switch
              id="valor-estoque"
              checked={config.incluir_valor_estoque}
              onCheckedChange={(checked) =>
                setConfig({ ...config, incluir_valor_estoque: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="horario">Horário de Envio</Label>
            <Select
              value={config.horario_envio}
              onValueChange={(value) =>
                setConfig({ ...config, horario_envio: value })
              }
            >
              <SelectTrigger id="horario">
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
            <p className="text-sm text-muted-foreground">
              Horário em que o relatório será enviado diariamente
            </p>
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
