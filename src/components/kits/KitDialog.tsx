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
import { Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useOrganization } from "@/hooks/useOrganization";

const kitSchema = z.object({
  sku: z.string().min(1, "SKU é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

type KitFormData = z.infer<typeof kitSchema>;

interface KitItem {
  product_id: string;
  quantity: number;
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
  const { data: organizationId } = useOrganization();

  const form = useForm<KitFormData>({
    resolver: zodResolver(kitSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      active: true,
    },
  });

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: ["products", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Fetch kit items if editing
  useEffect(() => {
    if (kit) {
      form.reset({
        sku: kit.sku,
        name: kit.name,
        description: kit.description || "",
        active: kit.active,
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
    } else {
      form.reset({
        sku: "",
        name: "",
        description: "",
        active: true,
      });
      setKitItems([]);
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
      if (kit) {
        // Update existing kit
        const { error: kitError } = await supabase
          .from("kits")
          .update({
            sku: values.sku,
            name: values.name,
            description: values.description,
            active: values.active,
          })
          .eq("id", kit.id);

        if (kitError) throw kitError;

        // Delete old items
        await supabase.from("kit_items").delete().eq("kit_id", kit.id);

        // Insert new items
        const { error: itemsError } = await supabase
          .from("kit_items")
          .insert(kitItems.map(item => ({ ...item, kit_id: kit.id })));

        if (itemsError) throw itemsError;

        toast.success("Kit atualizado com sucesso");
      } else {
        // Create new kit
        if (!organizationId) throw new Error("Organization not found");
        
        const { data: newKit, error: kitError } = await supabase
          .from("kits")
          .insert({
            sku: values.sku,
            name: values.name,
            description: values.description,
            active: values.active,
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
      onOpenChange(false);
      form.reset();
      setKitItems([]);
    } catch (error) {
      console.error("Error saving kit:", error);
      toast.error("Erro ao salvar kit");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
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
                  {kitItems.map((item, index) => (
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
                  ))}

                  {kitItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum produto adicionado. Clique em "Adicionar Produto" para começar.
                    </p>
                  )}
                </div>
              </div>
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
    </Dialog>
  );
}
