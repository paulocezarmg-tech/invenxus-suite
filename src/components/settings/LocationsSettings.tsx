import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const locationSchema = z.object({
  code: z.string().trim().min(1, "Código é obrigatório").max(50, "Código deve ter no máximo 50 caracteres"),
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  address: z.string().trim().max(500, "Endereço deve ter no máximo 500 caracteres").optional(),
  region: z.string().trim().max(200, "Região deve ter no máximo 200 caracteres").optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

export function LocationsSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: "",
      name: "",
      address: "",
      region: "",
    },
  });

  // Check user role
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-locations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (roles && roles.length > 0) {
        setUserRole(roles[0].role);
      }
      return user;
    },
  });

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (editingLocation) {
      form.reset({
        code: editingLocation.code,
        name: editingLocation.name,
        address: editingLocation.address || "",
        region: editingLocation.region || "",
      });
    } else {
      form.reset({
        code: "",
        name: "",
        address: "",
        region: "",
      });
    }
  }, [editingLocation, form]);

  const handleOpenDialog = (location?: any) => {
    setEditingLocation(location);
    setDialogOpen(true);
  };

  const onSubmit = async (data: LocationFormData) => {
    setIsSubmitting(true);
    try {
      const locationData = {
        code: data.code,
        name: data.name,
        address: data.address || null,
        region: data.region || null,
      };

      if (editingLocation) {
        const { error } = await supabase.from("locations").update(locationData).eq("id", editingLocation.id);
        if (error) throw error;
        toast.success("Local atualizado");
      } else {
        const { error } = await supabase.from("locations").insert(locationData);
        if (error) throw error;
        toast.success("Local criado");
      }
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este local?")) return;

    try {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
      toast.success("Local excluído");
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {userRole !== "operador" && (
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Local
          </Button>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Status</TableHead>
              {userRole !== "operador" && <TableHead className="w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : locations && locations.length > 0 ? (
              locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-mono">{location.code}</TableCell>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>{location.region || "-"}</TableCell>
                  <TableCell>
                    {location.active ? (
                      <Badge className="bg-success">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  {userRole !== "operador" && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(location)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(location.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </TableCell>
                  )}

                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum local encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Editar Local" : "Novo Local"}</DialogTitle>
            <DialogDescription>
              {editingLocation ? "Atualize as informações" : "Adicione um novo local"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="ALM-01" {...field} />
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
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Almoxarifado Central" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Região</FormLabel>
                    <FormControl>
                      <Input placeholder="Sede - São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua exemplo, 123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : editingLocation ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
