import { useEffect } from "react";
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

const formSchema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  descricao: z.string().min(3, "Descrição deve ter no mínimo 3 caracteres"),
  produto_id: z.string().optional(),
  valor: z.string().min(1, "Valor é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  quantidade: z.string().optional(),
});

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "entrada",
      descricao: "",
      produto_id: "none",
      valor: "",
      data: new Date().toISOString().split("T")[0],
      quantidade: "",
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-active"],
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

  useEffect(() => {
    if (movement) {
      form.reset({
        tipo: movement.tipo,
        descricao: movement.descricao,
        produto_id: movement.produto_id || "none",
        valor: movement.valor.toString(),
        data: movement.data,
        quantidade: movement.quantidade?.toString() || "",
      });
    } else {
      form.reset({
        tipo: "entrada",
        descricao: "",
        produto_id: "none",
        valor: "",
        data: new Date().toISOString().split("T")[0],
        quantidade: "",
      });
    }
  }, [movement, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get organization_id
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) throw new Error("Organização não encontrada");

      const payload = {
        tipo: values.tipo,
        descricao: values.descricao,
        produto_id: values.produto_id && values.produto_id !== "none" ? values.produto_id : null,
        valor: parseFloat(values.valor),
        data: values.data,
        quantidade: values.quantidade ? parseInt(values.quantidade) : null,
        user_id: user.id,
        organization_id: orgMember.organization_id,
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {movement ? "Editar Movimentação" : "Lançar Movimentação"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="produto_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} {product.sku && `(${product.sku})`}
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
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Opcional"
                      {...field}
                    />
                  </FormControl>
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

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva a movimentação..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
