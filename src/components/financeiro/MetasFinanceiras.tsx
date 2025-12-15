import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Plus, Target, TrendingUp, DollarSign, Percent, ShoppingCart, Trash2, Pencil } from "lucide-react";

interface Meta {
  id: string;
  tipo: string;
  valor_meta: number;
  periodo: string;
  mes: number | null;
  ano: number;
  ativo: boolean;
}

interface MetasFinanceirasProps {
  faturamentoAtual: number;
  lucroAtual: number;
  margemAtual: number;
  vendasAtual: number;
}

const TIPOS_META = [
  { value: "faturamento", label: "Faturamento", icon: DollarSign, color: "text-success" },
  { value: "lucro", label: "Lucro", icon: TrendingUp, color: "text-primary" },
  { value: "margem", label: "Margem %", icon: Percent, color: "text-amber-500" },
  { value: "vendas", label: "Vendas", icon: ShoppingCart, color: "text-purple-500" },
];

const PERIODOS = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
];

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export const MetasFinanceiras = ({ 
  faturamentoAtual, 
  lucroAtual, 
  margemAtual, 
  vendasAtual 
}: MetasFinanceirasProps) => {
  const { data: organizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null);
  
  const [formData, setFormData] = useState({
    tipo: "faturamento",
    valor_meta: "",
    periodo: "mensal",
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
  });

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas-financeiras", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("metas_financeiras")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Meta[];
    },
    enabled: !!organizationId,
  });

  const createMeta = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Não autenticado");

      const { error } = await supabase.from("metas_financeiras").insert({
        organization_id: organizationId,
        user_id: user.id,
        tipo: data.tipo,
        valor_meta: parseFloat(data.valor_meta),
        periodo: data.periodo,
        mes: data.periodo === "mensal" ? data.mes : null,
        ano: data.ano,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-financeiras"] });
      toast({ title: "Meta criada com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao criar meta", description: error.message, variant: "destructive" });
    },
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("metas_financeiras")
        .update({
          tipo: data.tipo,
          valor_meta: parseFloat(data.valor_meta),
          periodo: data.periodo,
          mes: data.periodo === "mensal" ? data.mes : null,
          ano: data.ano,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-financeiras"] });
      toast({ title: "Meta atualizada com sucesso!" });
      setIsDialogOpen(false);
      setEditingMeta(null);
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar meta", description: error.message, variant: "destructive" });
    },
  });

  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("metas_financeiras")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas-financeiras"] });
      toast({ title: "Meta removida" });
    },
    onError: (error) => {
      toast({ title: "Erro ao remover meta", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      tipo: "faturamento",
      valor_meta: "",
      periodo: "mensal",
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
    });
  };

  const handleEdit = (meta: Meta) => {
    setEditingMeta(meta);
    setFormData({
      tipo: meta.tipo,
      valor_meta: meta.valor_meta.toString(),
      periodo: meta.periodo,
      mes: meta.mes || new Date().getMonth() + 1,
      ano: meta.ano,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.valor_meta) {
      toast({ title: "Preencha o valor da meta", variant: "destructive" });
      return;
    }

    if (editingMeta) {
      updateMeta.mutate({ id: editingMeta.id, data: formData });
    } else {
      createMeta.mutate(formData);
    }
  };

  const getValorAtual = (tipo: string) => {
    switch (tipo) {
      case "faturamento": return faturamentoAtual;
      case "lucro": return lucroAtual;
      case "margem": return margemAtual;
      case "vendas": return vendasAtual;
      default: return 0;
    }
  };

  const getProgresso = (meta: Meta) => {
    const atual = getValorAtual(meta.tipo);
    const progresso = (atual / meta.valor_meta) * 100;
    return Math.min(progresso, 100);
  };

  const formatarValor = (tipo: string, valor: number) => {
    if (tipo === "margem") return `${valor.toFixed(1)}%`;
    if (tipo === "vendas") return valor.toFixed(0);
    return formatCurrency(valor);
  };

  const getTipoConfig = (tipo: string) => {
    return TIPOS_META.find(t => t.value === tipo) || TIPOS_META[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Metas Financeiras</h2>
          <p className="text-sm text-muted-foreground">Defina e acompanhe suas metas de desempenho</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingMeta(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMeta ? "Editar Meta" : "Criar Nova Meta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Meta</Label>
                <Select value={formData.tipo} onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_META.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor da Meta</Label>
                <Input
                  type="number"
                  placeholder={formData.tipo === "margem" ? "Ex: 30" : "Ex: 50000"}
                  value={formData.valor_meta}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor_meta: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={formData.periodo} onValueChange={(value) => setFormData(prev => ({ ...prev, periodo: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODOS.map(periodo => (
                      <SelectItem key={periodo.value} value={periodo.value}>
                        {periodo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.periodo === "mensal" && (
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select 
                    value={formData.mes.toString()} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, mes: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map(mes => (
                        <SelectItem key={mes.value} value={mes.value.toString()}>
                          {mes.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Ano</Label>
                <Input
                  type="number"
                  value={formData.ano}
                  onChange={(e) => setFormData(prev => ({ ...prev, ano: parseInt(e.target.value) }))}
                />
              </div>

              <Button 
                onClick={handleSubmit} 
                className="w-full"
                disabled={createMeta.isPending || updateMeta.isPending}
              >
                {editingMeta ? "Atualizar Meta" : "Criar Meta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-0 shadow-card animate-pulse">
              <CardContent className="pt-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metas && metas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metas.map(meta => {
            const config = getTipoConfig(meta.tipo);
            const Icon = config.icon;
            const progresso = getProgresso(meta);
            const atual = getValorAtual(meta.tipo);

            return (
              <Card key={meta.id} className="border-0 shadow-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {meta.periodo === "mensal" && meta.mes 
                          ? `${MESES.find(m => m.value === meta.mes)?.label}/${meta.ano}`
                          : meta.periodo === "trimestral"
                          ? `Trimestre ${meta.ano}`
                          : meta.ano
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(meta)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMeta.mutate(meta.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{formatarValor(meta.tipo, atual)}</p>
                      <p className="text-xs text-muted-foreground">
                        de {formatarValor(meta.tipo, meta.valor_meta)}
                      </p>
                    </div>
                    <div className={`text-lg font-semibold ${progresso >= 100 ? 'text-success' : 'text-muted-foreground'}`}>
                      {progresso.toFixed(0)}%
                    </div>
                  </div>
                  <Progress 
                    value={progresso} 
                    className={`h-2 ${progresso >= 100 ? '[&>div]:bg-success' : ''}`}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma meta cadastrada</p>
            <p className="text-sm text-muted-foreground">Crie sua primeira meta para acompanhar seu desempenho</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
