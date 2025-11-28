import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IAPrecoIdealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  itemType: "produto" | "kit";
  currentPrice: number;
  currentCost: number;
  currentMargin: number;
  onPriceApplied?: () => void;
}

export function IAPrecoIdealDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemType,
  currentPrice,
  currentCost,
  currentMargin,
  onPriceApplied,
}: IAPrecoIdealDialogProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [newPrice, setNewPrice] = useState("");

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("calcular-preco-ideal", {
        body: {
          itemId,
          itemName,
          itemType,
          currentPrice,
          currentCost,
          currentMargin,
          salesHistory: [],
        },
      });

      if (error) throw error;

      setRecommendation(data);
      setNewPrice(data.preco_recomendado.toFixed(2));
      toast.success("Preço ideal calculado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao calcular preço ideal:", error);
      if (error.message?.includes("429")) {
        toast.error("Muitas requisições. Aguarde um momento e tente novamente.");
      } else if (error.message?.includes("402")) {
        toast.error("Limite de créditos atingido. Adicione créditos em Configurações > Workspace.");
      } else {
        toast.error("Erro ao calcular preço ideal. Tente novamente.");
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApply = async () => {
    if (!newPrice || !recommendation) return;

    setIsApplying(true);
    try {
      const priceValue = parseFloat(newPrice);
      if (isNaN(priceValue) || priceValue <= 0) {
        toast.error("Preço inválido");
        return;
      }

      const table = itemType === "kit" ? "kits" : "products";
      const { error: updateError } = await supabase
        .from(table)
        .update({ preco_venda: priceValue })
        .eq("id", itemId);

      if (updateError) throw updateError;

      if (recommendation.recomendacao_id) {
        await supabase
          .from("recomendacoes_preco")
          .update({
            aplicado: true,
            data_aplicacao: new Date().toISOString(),
          })
          .eq("id", recommendation.recomendacao_id);
      }

      toast.success(`Preço atualizado para ${formatCurrency(priceValue)}!`);
      onPriceApplied?.();
      onOpenChange(false);
      setRecommendation(null);
      setNewPrice("");
    } catch (error) {
      console.error("Erro ao aplicar preço:", error);
      toast.error("Erro ao aplicar preço. Tente novamente.");
    } finally {
      setIsApplying(false);
    }
  };

  const getImpactBadge = (impacto: string) => {
    const variants = {
      baixo: { variant: "default" as const, icon: TrendingUp, color: "text-success" },
      moderado: { variant: "secondary" as const, icon: AlertTriangle, color: "text-warning" },
      alto: { variant: "destructive" as const, icon: AlertTriangle, color: "text-danger" },
    };
    const config = variants[impacto as keyof typeof variants] || variants.moderado;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        Impacto {impacto}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Calcular Preço Ideal com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Produto/Kit:</span>
                  <span className="text-sm font-medium">{itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Preço atual:</span>
                  <span className="text-sm font-medium">{formatCurrency(currentPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Custo total:</span>
                  <span className="text-sm font-medium">{formatCurrency(currentCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Margem atual:</span>
                  <span className="text-sm font-medium">{currentMargin.toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {!recommendation && (
            <Button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="w-full"
              size="lg"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Calcular Preço Ideal
                </>
              )}
            </Button>
          )}

          {recommendation && (
            <>
              <Card className="border-primary bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Preço Recomendado pela IA</Label>
                    {recommendation.impacto_demanda && getImpactBadge(recommendation.impacto_demanda)}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="text-2xl font-bold h-14"
                  />
                  
                  {recommendation.lucro_potencial && (
                    <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                      <span className="text-sm text-muted-foreground">Lucro potencial mensal estimado:</span>
                      <span className="text-lg font-bold text-success">
                        {formatCurrency(recommendation.lucro_potencial)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Análise da IA:</Label>
                    <div className="p-4 bg-background rounded-lg text-sm whitespace-pre-line">
                      {recommendation.analise_completa}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRecommendation(null);
                    setNewPrice("");
                  }}
                >
                  Recalcular
                </Button>
                <Button onClick={handleApply} disabled={isApplying}>
                  {isApplying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    "Aplicar Preço Recomendado"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
