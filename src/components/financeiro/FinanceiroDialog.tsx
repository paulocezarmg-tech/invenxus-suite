import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const formSchema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  descricao: z.string().optional(),
  produto_id: z.string().optional(),
  valor: z.string().min(1, "Valor é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  quantidade: z.string().optional(),
  custo_unitario: z.string().optional(),
  preco_venda: z.string().optional(),
});

interface CustoAdicional {
  descricao: string;
  valor: number;
}

interface ItemWithCost {
  id: string;
  name: string;
  sku: string;
  custo_unitario: number;
  preco_venda: number;
  isKit?: boolean;
}

interface FinanceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movement?: any;
  onSuccess: () => void;
}

export function FinanceiroDialog({
  open,
  onOpenChange,
  movement,
  onSuccess,
}: FinanceiroDialogProps) {
  const { toast } = useToast();
  const [custosAdicionais, setCustosAdicionais] = useState<CustoAdicional[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "entrada",
      descricao: "",
      produto_id: "none",
      valor: "",
      data: new Date().toISOString().split("T")[0],
      quantidade: "",
      custo_unitario: "",
      preco_venda: "",
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, custo_unitario, preco_venda")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: kits } = useQuery({
    queryKey: ["kits-with-cost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits")
        .select(`
          id,
          name,
          sku,
          kit_items (
            quantity,
            products (
              custo_unitario
            )
          )
        `)
        .eq("active", true)
        .order("name");
      
      if (error) throw error;
      
      // Calcular custo de cada kit
      return data?.map(kit => {
        const custoTotal = kit.kit_items.reduce((sum: number, item: any) => {
          const custoUnitario = item.products?.custo_unitario || 0;
          return sum + (custoUnitario * item.quantity);
        }, 0);
        
        return {
          id: kit.id,
          name: kit.name,
          sku: kit.sku,
          custo_unitario: custoTotal,
          preco_venda: 0,
          isKit: true,
        };
      }) || [];
    },
  });

  // Combinar produtos e kits
  const allItems: ItemWithCost[] = [
    ...(products?.map(p => ({ ...p, isKit: false })) || []), 
    ...(kits || [])
  ];

  useEffect(() => {
    if (movement) {
      form.reset({
        tipo: movement.tipo,
        descricao: movement.descricao,
        produto_id: movement.produto_id || "none",
        valor: movement.valor?.toString() || "",
        data: movement.data,
        quantidade: movement.quantidade?.toString() || "",
        custo_unitario: movement.custo_total?.toString() || "",
        preco_venda: movement.preco_venda?.toString() || "",
      });
      setCustosAdicionais(movement.custos_adicionais || []);
    } else {
      form.reset({
        tipo: "entrada",
        descricao: "",
        produto_id: "none",
        valor: "",
        data: new Date().toISOString().split("T")[0],
        quantidade: "",
        custo_unitario: "",
        preco_venda: "",
      });
      setCustosAdicionais([]);
    }
  }, [movement, form]);

  // Auto-preencher custos quando produto ou kit selecionado
  useEffect(() => {
    const itemId = form.watch("produto_id");
    if (itemId && itemId !== "none" && allItems) {
      const item = allItems.find(p => p.id === itemId);
      if (item) {
        if (item.custo_unitario) {
          form.setValue("custo_unitario", item.custo_unitario.toString());
        }
        if (item.preco_venda && !item.isKit) {
          form.setValue("preco_venda", item.preco_venda.toString());
        }
      }
    }
  }, [form.watch("produto_id"), allItems]);

  // Calcular valor total automaticamente
  useEffect(() => {
    const subscription = form.watch((value) => {
      const quantidade = parseFloat(value.quantidade || "1");
      const custoUnitario = parseFloat(value.custo_unitario || "0");
      const precoVenda = parseFloat(value.preco_venda || "0");
      const tipo = value.tipo;
      
      let valorCalculado = 0;
      
      if (tipo === "entrada") {
        // Para compras: quantidade * custo unitário
        valorCalculado = quantidade * custoUnitario;
      } else {
        // Para vendas: quantidade * preço de venda
        valorCalculado = quantidade * precoVenda;
      }
      
      // Adicionar custos adicionais
      const custoAdicionaisTotal = custosAdicionais.reduce((sum, c) => sum + c.valor, 0);
      valorCalculado += custoAdicionaisTotal;
      
      // Atualizar campo valor apenas se for diferente
      const valorAtual = parseFloat(value.valor || "0");
      if (valorCalculado > 0 && Math.abs(valorCalculado - valorAtual) > 0.01) {
        form.setValue("valor", valorCalculado.toFixed(2));
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, custosAdicionais]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) throw new Error("Organização não encontrada");

      const quantidade = values.quantidade ? parseInt(values.quantidade) : 1;
      const custoUnitario = values.custo_unitario ? parseFloat(values.custo_unitario) : 0;
      const precoVenda = values.preco_venda ? parseFloat(values.preco_venda) : parseFloat(values.valor);
      
      // Calcular custo total
      const custoProduto = custoUnitario * quantidade;
      const custoAdicionaisTotal = custosAdicionais.reduce((sum, c) => sum + c.valor, 0);
      const custoTotal = custoProduto + custoAdicionaisTotal;
      
      // Calcular lucro
      const lucroLiquido = precoVenda - custoTotal;
      const margemPercentual = precoVenda > 0 ? (lucroLiquido / precoVenda) * 100 : 0;

      const payload = {
        tipo: values.tipo,
        descricao: values.descricao,
        produto_id: values.produto_id && values.produto_id !== "none" ? values.produto_id : null,
        valor: parseFloat(values.valor),
        data: values.data,
        quantidade: values.quantidade ? parseInt(values.quantidade) : null,
        user_id: user.id,
        organization_id: orgMember.organization_id,
        custo_total: custoTotal,
        preco_venda: precoVenda,
        lucro_liquido: lucroLiquido,
        margem_percentual: margemPercentual,
        custos_adicionais: custosAdicionais as any,
      };

      if (movement) {
        const { error } = await supabase
          .from("financeiro")
          .update(payload)
          .eq("id", movement.id);

        if (error) throw error;

        toast({
          title: "Movimentação atualizada",
          description: "A movimentação foi atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("financeiro")
          .insert([payload]);

        if (error) throw error;

        toast({
          title: "Movimentação registrada",
          description: "A movimentação foi registrada com sucesso!",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {movement ? "Editar Movimentação" : "Lançar Movimentação"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entrada">Compra</SelectItem>
                        <SelectItem value="saida">Venda</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

              <FormField
                control={form.control}
                name="produto_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto / Kit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto ou kit (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {products && products.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Produtos
                            </div>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} {product.sku && `(${product.sku})`}
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
                                🎁 {kit.name} {kit.sku && `(${kit.sku})`}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva a movimentação... (opcional)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="custo_unitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo Unit.</FormLabel>
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
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preco_venda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Venda</FormLabel>
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
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => {
                const quantidade = parseFloat(form.watch("quantidade") || "1");
                const custoUnitario = parseFloat(form.watch("custo_unitario") || "0");
                const precoVenda = parseFloat(form.watch("preco_venda") || "0");
                const tipo = form.watch("tipo");
                const custoAdicionaisTotal = custosAdicionais.reduce((sum, c) => sum + c.valor, 0);
                
                let custoBase = 0;
                let vendaTotal = 0;
                
                if (tipo === "entrada") {
                  custoBase = quantidade * custoUnitario;
                } else {
                  vendaTotal = quantidade * precoVenda;
                  custoBase = quantidade * custoUnitario;
                }
                
                const valorTotal = parseFloat(field.value || "0");
                const lucroEstimado = tipo === "saida" ? vendaTotal - custoBase - custoAdicionaisTotal : 0;
                
                return (
                  <FormItem>
                    <FormLabel>Valor Total *</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            R$
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            className="pl-10 text-lg font-semibold"
                            {...field}
                            readOnly
                          />
                        </div>
                        
                        {valorTotal > 0 && (
                          <div className="text-xs space-y-1 p-3 rounded-md bg-muted/50">
                            <div className="font-semibold text-muted-foreground mb-2">Prévia do Cálculo:</div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Quantidade:</span>
                              <span className="font-medium">{quantidade}</span>
                            </div>
                            {tipo === "entrada" && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Custo unitário:</span>
                                  <span className="font-medium">{formatCurrency(custoUnitario)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal:</span>
                                  <span className="font-medium">{formatCurrency(custoBase)}</span>
                                </div>
                              </>
                            )}
                            {tipo === "saida" && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Preço de venda:</span>
                                  <span className="font-medium">{formatCurrency(precoVenda)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal venda:</span>
                                  <span className="font-medium">{formatCurrency(vendaTotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Custo estimado:</span>
                                  <span className="font-medium text-destructive">-{formatCurrency(custoBase)}</span>
                                </div>
                              </>
                            )}
                            {custoAdicionaisTotal > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Custos adicionais:</span>
                                <span className="font-medium text-destructive">+{formatCurrency(custoAdicionaisTotal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-2 border-t mt-2">
                              <span className="font-semibold">Total:</span>
                              <span className="font-bold text-primary">{formatCurrency(valorTotal)}</span>
                            </div>
                            {tipo === "saida" && lucroEstimado !== 0 && (
                              <div className="flex justify-between pt-1">
                                <span className="font-semibold">Lucro estimado:</span>
                                <span className={`font-bold ${lucroEstimado >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {formatCurrency(lucroEstimado)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {movement ? "Atualizar" : "Salvar Movimentação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}