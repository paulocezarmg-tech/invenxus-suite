import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  max_users: number;
  max_companies: number;
  max_products: number;
  max_movements: number;
  ai_features: any;
  status: string;
}

export default function PlansManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    description: "",
    max_users: 1,
    max_companies: 1,
    max_products: 100,
    max_movements: 1000,
    ai_enabled: false,
    ai_monthly_limit: 0,
    status: "active",
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: async (plan: typeof formData) => {
      const planData = {
        name: plan.name,
        price: plan.price,
        description: plan.description,
        max_users: plan.max_users,
        max_companies: plan.max_companies,
        max_products: plan.max_products,
        max_movements: plan.max_movements,
        ai_features: {
          enabled: plan.ai_enabled,
          monthly_limit: plan.ai_monthly_limit,
        },
        status: plan.status,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("plans")
          .update(planData)
          .eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(planData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans-management"] });
      toast.success(editingPlan ? "Plano atualizado!" : "Plano criado!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao salvar plano");
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans-management"] });
      toast.success("Plano excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir plano");
    },
  });

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        price: plan.price,
        description: plan.description || "",
        max_users: plan.max_users,
        max_companies: plan.max_companies,
        max_products: plan.max_products,
        max_movements: plan.max_movements,
        ai_enabled: plan.ai_features.enabled,
        ai_monthly_limit: plan.ai_features.monthly_limit,
        status: plan.status,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        price: 0,
        description: "",
        max_users: 1,
        max_companies: 1,
        max_products: 100,
        max_movements: 1000,
        ai_enabled: false,
        ai_monthly_limit: 0,
        status: "active",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
  };

  const handleSave = () => {
    if (!formData.name || formData.price < 0) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    savePlanMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Planos</h2>
          <p className="text-muted-foreground">Crie e edite os planos de assinatura</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                  {plan.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold">
                  {plan.price === 0 ? "Grátis" : `R$ ${plan.price.toFixed(2)}/mês`}
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p>👥 {plan.max_users} usuário(s)</p>
                <p>🏢 {plan.max_companies} empresa(s)</p>
                <p>📦 {plan.max_products} produtos</p>
                <p>📊 {plan.max_movements} movimentações</p>
                {plan.ai_features.enabled && (
                  <p>✨ {plan.ai_features.monthly_limit} consultas IA/mês</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenDialog(plan)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja excluir este plano?")) {
                      deletePlanMutation.mutate(plan.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            <DialogDescription>
              Configure os limites e preço do plano
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Plano *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Profissional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço Mensal (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o plano"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max_users">Máx. Usuários</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_companies">Máx. Empresas</Label>
                <Input
                  id="max_companies"
                  type="number"
                  value={formData.max_companies}
                  onChange={(e) => setFormData({ ...formData, max_companies: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max_products">Máx. Produtos</Label>
                <Input
                  id="max_products"
                  type="number"
                  value={formData.max_products}
                  onChange={(e) => setFormData({ ...formData, max_products: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_movements">Máx. Movimentações</Label>
                <Input
                  id="max_movements"
                  type="number"
                  value={formData.max_movements}
                  onChange={(e) => setFormData({ ...formData, max_movements: parseInt(e.target.value) })}
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai_enabled">Recursos de IA</Label>
                <Switch
                  id="ai_enabled"
                  checked={formData.ai_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, ai_enabled: checked })
                  }
                />
              </div>
              {formData.ai_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="ai_monthly_limit">Limite Mensal de IA</Label>
                  <Input
                    id="ai_monthly_limit"
                    type="number"
                    value={formData.ai_monthly_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, ai_monthly_limit: parseInt(e.target.value) })
                    }
                    min="0"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="status">Status</Label>
              <Switch
                id="status"
                checked={formData.status === "active"}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, status: checked ? "active" : "inactive" })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={savePlanMutation.isPending}>
              {savePlanMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
