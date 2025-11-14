import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/useOrganization";

const productSchema = z.object({
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().optional(),
  category_id: z.string().optional(),
  unit: z.string().min(1, "Unidade é obrigatória"),
  cost: z.string().optional(),
  min_quantity: z.string().min(0, "Quantidade mínima deve ser positiva"),
  location_id: z.string().optional(),
  supplier_id: z.string().optional(),
  initial_quantity: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState("");
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
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

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          sku: product.sku,
          barcode: product.barcode || "",
          name: product.name,
          description: product.description || "",
          category_id: product.category_id || "",
          unit: product.unit,
          cost: String(product.cost),
          min_quantity: String(product.min_quantity),
          location_id: product.location_id || "",
          supplier_id: product.supplier_id || "",
        }
      : {
          sku: "",
          barcode: "",
          name: "",
          description: "",
          category_id: "",
          unit: "UN",
          cost: "",
          min_quantity: "0",
          location_id: "",
          supplier_id: "",
          initial_quantity: "",
        },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        sku: product.sku,
        barcode: product.barcode || "",
        name: product.name,
        description: product.description || "",
        category_id: product.category_id || "",
        unit: product.unit,
        cost: String(product.cost),
        min_quantity: String(product.min_quantity),
        location_id: product.location_id || "",
        supplier_id: product.supplier_id || "",
      });
    } else {
      form.reset({
        sku: "",
        barcode: "",
        name: "",
        description: "",
        category_id: "",
        unit: "UN",
        cost: "",
        min_quantity: "0",
        location_id: "",
        supplier_id: "",
      });
    }
    setIsCustomUnit(false);
    setCustomUnit("");
  }, [product, form]);

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      if (!organizationId) throw new Error("Organization not found");

      // Generate SKU if not provided
      let sku = data.sku?.trim() || "";
      if (!sku) {
        // Get the count of existing products to generate sequential SKU
        const { count } = await supabase
          .from("products")
          .select("*", { count: 'exact', head: true })
          .eq("organization_id", organizationId);
        
        const nextNumber = (count || 0) + 1;
        sku = `SKU-${nextNumber.toString().padStart(4, '0')}`;
        
        // Check if this SKU already exists (in case of concurrent creation)
        const { data: existingCheck } = await supabase
          .from("products")
          .select("id")
          .eq("sku", sku)
          .eq("organization_id", organizationId);
        
        if (existingCheck && existingCheck.length > 0) {
          // If exists, append random suffix
          const random = Math.floor(Math.random() * 99).toString().padStart(2, '0');
          sku = `SKU-${nextNumber.toString().padStart(4, '0')}-${random}`;
        }
      }

      // Validate SKU uniqueness
      const { data: existingSku } = await supabase
        .from("products")
        .select("id")
        .eq("sku", sku)
        .eq("organization_id", organizationId)
        .neq("id", product?.id || "00000000-0000-0000-0000-000000000000");

      if (existingSku && existingSku.length > 0) {
        toast.error("SKU já existe. Por favor, use um SKU diferente.");
        setIsSubmitting(false);
        return;
      }

      // Validate barcode uniqueness if provided
      if (data.barcode) {
        const { data: existingBarcode } = await supabase
          .from("products")
          .select("id")
          .eq("barcode", data.barcode)
          .eq("organization_id", organizationId)
          .neq("id", product?.id || "00000000-0000-0000-0000-000000000000");

        if (existingBarcode && existingBarcode.length > 0) {
          toast.error("Código de barras já existe. Por favor, use um código diferente.");
          setIsSubmitting(false);
          return;
        }
      }
      
      const productData = {
        sku: sku,
        barcode: data.barcode || null,
        name: data.name,
        description: data.description || null,
        category_id: data.category_id || null,
        unit: data.unit,
        cost: data.cost ? parseFloat(data.cost) : 0,
        quantity: product ? parseFloat(String(product.quantity)) : 0,
        min_quantity: parseFloat(data.min_quantity),
        location_id: data.location_id || null,
        supplier_id: data.supplier_id || null,
        organization_id: organizationId,
      };

      if (product) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado com sucesso");
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        
        if (error) throw error;

        // Se houver quantidade inicial, criar movimentação de entrada
        const initialQty = data.initial_quantity ? parseFloat(data.initial_quantity) : 0;
        if (initialQty > 0 && newProduct) {
          const { data: { user } } = await supabase.auth.getUser();
          
          const movementData = {
            product_id: newProduct.id,
            type: 'IN' as const,
            quantity: initialQty,
            to_location_id: data.location_id || null,
            note: 'Entrada inicial ao cadastrar produto',
            reference: sku,
            organization_id: organizationId,
            created_by: user?.id,
          };

          const { error: movementError } = await supabase
            .from("movements")
            .insert(movementData);

          if (movementError) {
            console.error("Erro ao criar movimentação inicial:", movementError);
            toast.warning("Produto criado, mas não foi possível registrar a entrada inicial");
          }
        }
        
        toast.success("Produto criado com sucesso");
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Atualize as informações do produto"
              : "Adicione um novo produto ao catálogo"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Deixe vazio para gerar automaticamente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Barras</FormLabel>
                    <FormControl>
                      <Input placeholder="7891234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do produto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição do produto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
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
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade *</FormLabel>
                    {!isCustomUnit ? (
                      <Select 
                        onValueChange={(value) => {
                          if (value === "CUSTOM") {
                            setIsCustomUnit(true);
                            setCustomUnit("");
                          } else {
                            field.onChange(value);
                          }
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-50">
                          <SelectItem value="UN">Unidade</SelectItem>
                          <SelectItem value="KG">Quilograma</SelectItem>
                          <SelectItem value="L">Litro</SelectItem>
                          <SelectItem value="M">Metro</SelectItem>
                          <SelectItem value="CX">Caixa</SelectItem>
                          <div className="border-t border-border my-1" />
                          <SelectItem value="CUSTOM" className="text-primary font-medium">
                            + Adicionar outra...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder="Ex: PCT, DZ, etc"
                              value={customUnit}
                              onChange={(e) => {
                                const value = e.target.value.toUpperCase();
                                setCustomUnit(value);
                                field.onChange(value);
                              }}
                              maxLength={10}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsCustomUnit(false);
                              setCustomUnit("");
                              field.onChange("UN");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Digite a sigla da unidade (máximo 10 caracteres)
                        </p>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Qtd. Mínima *</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!product && (
              <FormField
                control={form.control}
                name="initial_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade Inicial</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="1" 
                        min="0" 
                        placeholder="Deixe vazio se não houver estoque inicial"
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Informe a quantidade inicial se já possui este produto em estoque
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local</FormLabel>
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
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers?.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : product ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
