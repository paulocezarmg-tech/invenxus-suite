import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { IAPrecoIdealDialog } from "@/components/financeiro/IAPrecoIdealDialog";

const kitSchema = z.object({
  sku: z.string().min(1, "SKU é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  active: z.boolean().default(true),
  preco_venda: z.string().optional(),
});

type KitFormData = z.infer<typeof kitSchema>;

interface KitItem {
  product_id: string;
  quantity: number;
}

interface CustoAdicional {
  descricao: string;
  valor: number;
}

interface KitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit?: any;
}

export function KitDialog({ open, onOpenChange, kit }: KitDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kitItems, setKitItems] = useState<KitItem[]>([]);
  const [custosAdicionais, setCustosAdicionais] = useState<CustoAdicional[]>([]);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const { data: organizationId } = useOrganization();

  const form = useForm<KitFormData>({
    resolver: zodResolver(kitSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      active: true,
      preco_venda: "",
    },
  });

  // Fetch products for dropdown with costs
  const { data: products } = useQuery({
    queryKey: ["products-with-cost", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, custo_unitario")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Calcular custo total do kit
  const custoTotalKit = kitItems.reduce((sum, item) => {
    const product = products?.find(p => p.id === item.product_id);
    const custoUnitario = product?.custo_unitario || 0;
    return sum + (custoUnitario * item.quantity);
  }, 0);

  const custoAdicionaisTotal = custosAdicionais.reduce((sum, c) => sum + c.valor, 0);
  const custoTotal = custoTotalKit + custoAdicionaisTotal;
  const precoVenda = parseFloat(form.watch("preco_venda") || "0");
  const lucroEstimado = precoVenda - custoTotal;
  const margemLucro = precoVenda > 0 ? (lucroEstimado / precoVenda) * 100 : 0;

  // Fetch kit items if editing
  useEffect(() => {
    if (kit) {
      form.reset({
        sku: kit.sku,
        name: kit.name,
        description: kit.description || "",
        active: kit.active,
        preco_venda: kit.preco_venda?.toString() || "",
      });

      // Fetch kit items
      supabase
        .from("kit_items")
        .select("product_id, quantity")
        .eq("kit_id", kit.id)
        .then(({ data }) => {
          if (data) {
            setKitItems(data);
          }
        });
      
      setCustosAdicionais(kit.custos_adicionais || []);
    } else {
      form.reset({
        sku: "",
        name: "",
        description: "",
        active: true,
        preco_venda: "",
      });
      setKitItems([]);
      setCustosAdicionais([]);
    }
  }, [kit, form]);

  const addItem = () => {
    setKitItems([...kitItems, { product_id: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setKitItems(kitItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof KitItem, value: any) => {
    const newItems = [...kitItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setKitItems(newItems);
  };

  const onSubmit = async (values: KitFormData) => {
    if (kitItems.length === 0) {
      toast.error("Adicione pelo menos um produto ao kit");
      return;
    }

    if (kitItems.some(item => !item.product_id || item.quantity <= 0)) {
      toast.error("Preencha todos os itens corretamente");
      return;
    }

    setIsSubmitting(true);

    try {
      const kitData = {
        sku: values.sku,
        name: values.name,
        description: values.description,
        active: values.active,
        preco_venda: values.preco_venda ? parseFloat(values.preco_venda) : 0,
        custos_adicionais: custosAdicionais as any,
      };

      if (kit) {
        // Validate SKU uniqueness
        const { data: existingSku } = await supabase
          .from("kits")
          .select("id")
          .eq("sku", values.sku)
          .eq("organization_id", organizationId)
          .neq("id", kit.id);

        if (existingSku && existingSku.length > 0) {
          toast.error("SKU já existe. Por favor, use um SKU diferente.");
          setIsSubmitting(false);
          return;
        }

        // Update existing kit
        const { error: kitError } = await supabase
          .from("kits")
          .update(kitData)
          .eq("id", kit.id);

        if (kitError) throw kitError;

        // Fetch existing items to compare
        const { data: existingItems } = await supabase
          .from("kit_items")
          .select("id, product_id, quantity")
          .eq("kit_id", kit.id);

        // Delete items that are no longer in the list
        const itemsToDelete = existingItems?.filter(
          (existing) =>
            !kitItems.some((item) => item.product_id === existing.product_id)
        ) || [];

        if (itemsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("kit_items")
            .delete()
            .in(
              "id",
              itemsToDelete.map((item) => item.id)
            );

          if (deleteError) throw deleteError;
        }

        // Update or insert items
        for (const item of kitItems) {
          const existingItem = existingItems?.find(
            (ei) => ei.product_id === item.product_id
          );

          if (existingItem) {
            // Update quantity if changed
            if (existingItem.quantity !== item.quantity) {
              const { error: updateError } = await supabase
                .from("kit_items")
                .update({ quantity: item.quantity })
                .eq("id", existingItem.id);

              if (updateError) throw updateError;
            }
          } else {
            // Insert new item
            const { error: insertError } = await supabase
              .from("kit_items")
              .insert({ ...item, kit_id: kit.id });

            if (insertError) throw insertError;
          }
        }

        toast.success("Kit atualizado com sucesso");
      } else {
        // Create new kit
        if (!organizationId) throw new Error("Organization not found");

        // Validate SKU uniqueness for new kit
        const { data: existingSku } = await supabase
          .from("kits")
          .select("id")
          .eq("sku", values.sku)
          .eq("organization_id", organizationId);

        if (existingSku && existingSku.length > 0) {
          toast.error("SKU já existe. Por favor, use um SKU diferente.");
          setIsSubmitting(false);
          return;
        }
        
        const { data: newKit, error: kitError } = await supabase
          .from("kits")
          .insert({
            ...kitData,
            organization_id: organizationId,
          })
          .select()
          .single();

        if (kitError) throw kitError;

        // Insert items
        const { error: itemsError } = await supabase
          .from("kit_items")
          .insert(kitItems.map(item => ({ ...item, kit_id: newKit.id })));

        if (itemsError) throw itemsError;

        toast.success("Kit criado com sucesso");
      }

      queryClient.invalidateQueries({ queryKey: ["kits"] });
      queryClient.invalidateQueries({ queryKey: ["kits-with-cost"] });
      onOpenChange(false);
      form.reset();
      setKitItems([]);
      setCustosAdicionais([]);
    } catch (error) {
      console.error("Error saving kit:", error);
      toast.error("Erro ao salvar kit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{kit ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          <DialogDescription>
            {kit
              ? "Edite as informações do kit"
              : "Crie um novo kit de produtos"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ativo</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Produtos do Kit</FormLabel>
                  <Button type="button" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Produto
                  </Button>
                </div>

                <div className="space-y-2">
                  {kitItems.map((item, index) => {
                    const product = products?.find(p => p.id === item.product_id);
                    const custoItem = product ? (product.custo_unitario || 0) * item.quantity : 0;
                    
                    return (
                      <div key={index} className="flex gap-2 items-start border p-3 rounded-lg">
                        <div className="flex-1">
                          <Select
                            value={item.product_id}
                            onValueChange={(value) => updateItem(index, "product_id", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {product && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Custo: {formatCurrency(custoItem)}
                            </div>
                          )}
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value))}
                            placeholder="Qtd"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}

                  {kitItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum produto adicionado. Clique em "Adicionar Produto" para começar.
                    </p>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="preco_venda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Venda</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {kit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 gap-2"
                        onClick={() => setPriceDialogOpen(true)}
                      >
                        <Sparkles className="h-3 w-3" />
                        Gerar Preço Ideal com IA
                      </Button>
                    )}
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Custos Adicionais</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Frete, impostos, taxas, etc.
                </p>
                <div className="space-y-2">
                  {custosAdicionais.map((custo, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Descrição (ex: Frete, Imposto)"
                        value={custo.descricao}
                        onChange={(e) => {
                          const novos = [...custosAdicionais];
                          novos[index].descricao = e.target.value;
                          setCustosAdicionais(novos);
                        }}
                        className="flex-1"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={custo.valor}
                          onChange={(e) => {
                            const novos = [...custosAdicionais];
                            novos[index].valor = parseFloat(e.target.value) || 0;
                            setCustosAdicionais(novos);
                          }}
                          className="pl-10"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const novos = custosAdicionais.filter((_, i) => i !== index);
                          setCustosAdicionais(novos);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustosAdicionais([...custosAdicionais, { descricao: "", valor: 0 }])}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Custo
                  </Button>
                </div>
              </div>

              {/* Prévia dos Cálculos */}
              {kitItems.length > 0 && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <div className="font-semibold text-sm text-muted-foreground mb-2">Prévia do Kit:</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo dos produtos:</span>
                    <span className="font-medium">{formatCurrency(custoTotalKit)}</span>
                  </div>
                  {custoAdicionaisTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custos adicionais:</span>
                      <span className="font-medium text-destructive">+{formatCurrency(custoAdicionaisTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="font-semibold">Custo Total:</span>
                    <span className="font-bold text-destructive">{formatCurrency(custoTotal)}</span>
                  </div>
                  {precoVenda > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">Preço de Venda:</span>
                        <span className="font-bold text-primary">{formatCurrency(precoVenda)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="font-semibold">Lucro Estimado:</span>
                        <span className={`font-bold ${lucroEstimado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(lucroEstimado)} ({margemLucro.toFixed(1)}%)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : kit ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {kit && (
        <IAPrecoIdealDialog
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          itemId={kit.id}
          itemName={kit.name}
          itemType="kit"
          currentPrice={kit.preco_venda || 0}
          currentCost={custoTotal}
          currentMargin={margemLucro}
          onPriceApplied={() => {
            queryClient.invalidateQueries({ queryKey: ["kits"] });
            queryClient.invalidateQueries({ queryKey: ["kits-with-cost"] });
            setPriceDialogOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}