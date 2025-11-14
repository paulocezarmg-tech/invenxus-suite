import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";

const movementSchema = z.object({
  type: z.enum(["IN", "OUT", "TRANSFER"]),
  item_type: z.enum(["product", "kit"]),
  product_id: z.string().optional(),
  kit_id: z.string().optional(),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  from_location_id: z.string().optional(),
  to_location_id: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
}).refine((data) => data.product_id || data.kit_id, {
  message: "Selecione um produto ou kit",
  path: ["product_id"],
});

type MovementFormData = z.infer<typeof movementSchema>;

interface CustoAdicional {
  descricao: string;
  valor: number;
}

interface MovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movement?: any;
}

export function MovementDialog({ open, onOpenChange, movement }: MovementDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [custoUnitario, setCustoUnitario] = useState(0);
  const [openProductCombo, setOpenProductCombo] = useState(false);
  const [openKitCombo, setOpenKitCombo] = useState(false);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

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

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      type: "IN",
      item_type: "product",
      product_id: "",
      kit_id: "",
      quantity: "",
      from_location_id: "",
      to_location_id: "",
      reference: "",
      note: "",
    },
  });

  useEffect(() => {
    if (movement) {
      form.reset({
        type: movement.type,
        item_type: movement.kit_id ? "kit" : "product",
        product_id: movement.product_id || "",
        kit_id: movement.kit_id || "",
        quantity: String(movement.quantity),
        from_location_id: movement.from_location_id || "",
        to_location_id: movement.to_location_id || "",
        reference: movement.reference || "",
        note: movement.note || "",
      });
    } else {
      form.reset({
        type: "IN",
        item_type: "product",
        product_id: "",
        kit_id: "",
        quantity: "",
        from_location_id: "",
        to_location_id: "",
        reference: "",
        note: "",
      });
    }
  }, [movement, form]);

  const movementType = form.watch("type");
  const itemType = form.watch("item_type");
  const productId = form.watch("product_id");
  const kitId = form.watch("kit_id");
  const quantity = form.watch("quantity");

  // Fetch cost when product/kit changes
  useEffect(() => {
    const fetchCost = async () => {
      if (itemType === "product" && productId) {
        const { data: product } = await supabase
          .from("products")
          .select("custo_unitario")
          .eq("id", productId)
          .single();
        
        if (product) {
          setCustoUnitario(Number(product.custo_unitario) || 0);
        }
      } else if (itemType === "kit" && kitId) {
        const { data: kit } = await supabase
          .from("kits")
          .select(`
            custos_adicionais,
            kit_items (
              quantity,
              products (custo_unitario)
            )
          `)
          .eq("id", kitId)
          .single();
        
        if (kit) {
          let kitCost = 0;
          if (kit.kit_items) {
            for (const item of kit.kit_items) {
              const productCost = Number(item.products?.custo_unitario) || 0;
              kitCost += productCost * Number(item.quantity);
            }
          }

          if (kit.custos_adicionais && Array.isArray(kit.custos_adicionais)) {
            for (const custo of kit.custos_adicionais as unknown as CustoAdicional[]) {
              kitCost += Number(custo.valor) || 0;
            }
          }

          setCustoUnitario(kitCost);
        }
      } else {
        setCustoUnitario(0);
      }
    };

    fetchCost();
  }, [productId, kitId, itemType]);

  const onSubmit = async (data: MovementFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      if (!organizationId) throw new Error("Organization not found");

      const quantity = parseFloat(data.quantity);

      // Validate sufficient stock for OUT movements (only for products, not kits)
      if (data.type === "OUT" && data.item_type === "product" && data.product_id) {
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("quantity, name")
          .eq("id", data.product_id)
          .single();

        if (productError) throw productError;

        if (!productData) {
          toast.error("Produto não encontrado");
          setIsSubmitting(false);
          return;
        }

        const currentQuantity = Number(productData.quantity);
        if (currentQuantity < quantity) {
          toast.error(
            `Estoque insuficiente! Disponível: ${currentQuantity}, Solicitado: ${quantity}`
          );
          setIsSubmitting(false);
          return;
        }
      }

      const movementData = {
        type: data.type,
        product_id: data.item_type === "product" ? data.product_id : null,
        kit_id: data.item_type === "kit" ? data.kit_id : null,
        quantity: quantity,
        from_location_id: data.from_location_id || null,
        to_location_id: data.to_location_id || null,
        reference: data.reference || null,
        note: data.note || null,
        created_by: user.id,
        organization_id: organizationId,
      };

      if (movement) {
        const { error } = await supabase
          .from("movements")
          .update(movementData)
          .eq("id", movement.id);
        if (error) throw error;
        toast.success("Movimentação atualizada com sucesso");
      } else {
        const { error } = await supabase.from("movements").insert(movementData);
        if (error) throw error;

        // Create financial record for IN and OUT movements
        if (data.type === "IN" || data.type === "OUT") {
          let itemData = null;
          let itemName = "";
          let custoUnitario = 0;
          let precoVenda = 0;

          if (data.item_type === "product" && data.product_id) {
            const { data: product } = await supabase
              .from("products")
              .select("name, custo_unitario, preco_venda")
              .eq("id", data.product_id)
              .single();
            
            if (product) {
              itemData = product;
              itemName = product.name;
              custoUnitario = Number(product.custo_unitario) || 0;
              precoVenda = Number(product.preco_venda) || 0;
            }
          } else if (data.item_type === "kit" && data.kit_id) {
            const { data: kit } = await supabase
              .from("kits")
              .select(`
                name,
                preco_venda,
                custos_adicionais,
                kit_items (
                  quantity,
                  products (custo_unitario)
                )
              `)
              .eq("id", data.kit_id)
              .single();
            
            if (kit) {
              itemData = kit;
              itemName = kit.name;
              precoVenda = Number(kit.preco_venda) || 0;

              // Calculate kit cost from components
              let kitCost = 0;
              if (kit.kit_items) {
                for (const item of kit.kit_items) {
                  const productCost = Number(item.products?.custo_unitario) || 0;
                  kitCost += productCost * Number(item.quantity);
                }
              }

              // Add additional costs
              if (kit.custos_adicionais && Array.isArray(kit.custos_adicionais)) {
                for (const custo of kit.custos_adicionais as unknown as CustoAdicional[]) {
                  kitCost += Number(custo.valor) || 0;
                }
              }

              custoUnitario = kitCost;
            }
          }

          if (itemData) {
            const custoTotal = custoUnitario * quantity;
            const valorTotal = data.type === "OUT" ? precoVenda * quantity : custoTotal;
            const lucroLiquido = data.type === "OUT" ? (precoVenda - custoUnitario) * quantity : 0;
            const margemPercentual = data.type === "OUT" && precoVenda > 0 
              ? ((precoVenda - custoUnitario) / precoVenda) * 100 
              : 0;

            const financeiroData = {
              tipo: data.type === "IN" ? "entrada" : "saida",
              data: new Date().toISOString().split('T')[0],
              descricao: `${data.type === "IN" ? "Entrada" : "Saída"} - ${itemName}${data.reference ? ` (${data.reference})` : ""}`,
              produto_id: data.item_type === "product" ? data.product_id : data.kit_id,
              quantidade: quantity,
              custo_total: custoTotal,
              preco_venda: precoVenda,
              valor: valorTotal,
              lucro_liquido: lucroLiquido,
              margem_percentual: margemPercentual,
              custos_adicionais: [],
              user_id: user.id,
              organization_id: organizationId,
            };

            await supabase.from("financeiro").insert(financeiroData);
          }
        }

        toast.success("Movimentação registrada com sucesso");
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["critical-products"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar movimentação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{movement ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
          <DialogDescription>
            {movement
              ? "Atualize os detalhes da movimentação"
              : "Registre entrada, saída ou transferência de estoque"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimentação *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="IN">Entrada</SelectItem>
                      <SelectItem value="OUT">Saída</SelectItem>
                      <SelectItem value="TRANSFER">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="item_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Item *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="product">Produto</SelectItem>
                      <SelectItem value="kit">Kit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {itemType === "product" ? (
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Produto *</FormLabel>
                    <Popover open={openProductCombo} onOpenChange={setOpenProductCombo}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openProductCombo}
                            className={cn(
                              "w-full justify-between h-10",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? products?.find((product) => product.id === field.value)?.name
                              : "Selecione o produto"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Digite para buscar..." />
                          <CommandList>
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                              {products?.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.sku} ${product.name}`}
                                  onSelect={() => {
                                    form.setValue("product_id", product.id);
                                    setOpenProductCombo(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === product.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {product.sku} - {product.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="kit_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Kit *</FormLabel>
                    <Popover open={openKitCombo} onOpenChange={setOpenKitCombo}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openKitCombo}
                            className={cn(
                              "w-full justify-between h-10",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? kits?.find((kit) => kit.id === field.value)?.name
                              : "Selecione o kit"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Digite para buscar..." />
                          <CommandList>
                            <CommandEmpty>Nenhum kit encontrado.</CommandEmpty>
                            <CommandGroup>
                              {kits?.map((kit) => (
                                <CommandItem
                                  key={kit.id}
                                  value={`${kit.sku} ${kit.name}`}
                                  onSelect={() => {
                                    form.setValue("kit_id", kit.id);
                                    setOpenKitCombo(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === kit.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {kit.sku} - {kit.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade *</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" min="1" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {movementType === "IN" && custoUnitario > 0 && quantity && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Custo Unitário:</span>
                  <span className="text-sm">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(custoUnitario)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium">Valor Total:</span>
                  <span className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(custoUnitario * parseFloat(quantity || '0'))}
                  </span>
                </div>
              </div>
            )}

            {movementType === "TRANSFER" && (
              <>
                <FormField
                  control={form.control}
                  name="from_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>De (Local de Origem)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations?.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="to_location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Para (Local de Destino)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations?.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {movementType === "IN" && (
              <FormField
                control={form.control}
                name="to_location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local de Entrada</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {movementType === "OUT" && (
              <FormField
                control={form.control}
                name="from_location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local de Saída</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referência/Nota Fiscal</FormLabel>
                  <FormControl>
                    <Input placeholder="NF-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações adicionais..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : movement ? "Atualizar" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
