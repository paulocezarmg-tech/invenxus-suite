import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, MapPin, Search, Hash, Building } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useOrganization } from "@/hooks/useOrganization";

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
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

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

  const filteredLocations = locations?.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      if (!organizationId) throw new Error("Organization not found");
      
      const locationData = {
        code: data.code,
        name: data.name,
        address: data.address || null,
        region: data.region || null,
        organization_id: organizationId,
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
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Locais</CardTitle>
                <CardDescription>Gerencie os locais de armazenamento</CardDescription>
              </div>
            </div>
            {userRole !== "operador" && (
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Local
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-border/50"
            />
          </div>

          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-muted-foreground font-medium">Código</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Nome</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Região</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                  {userRole !== "operador" && <TableHead className="w-[100px] text-muted-foreground font-medium">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredLocations && filteredLocations.length > 0 ? (
                  filteredLocations.map((location) => (
                    <TableRow key={location.id} className="border-border/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-muted/50">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <code className="text-sm font-mono bg-muted/50 px-2 py-0.5 rounded">
                            {location.code}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{location.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {location.region ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 text-muted-foreground/50" />
                            <span>{location.region}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {location.active ? (
                          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      {userRole !== "operador" && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenDialog(location)}
                              className="h-8 w-8 hover:bg-primary/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(location.id)}
                              className="h-8 w-8 hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <MapPin className="h-8 w-8 text-muted-foreground/50" />
                        <span>Nenhum local encontrado</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              {editingLocation ? "Editar Local" : "Novo Local"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation ? "Atualize as informações do local" : "Adicione um novo local de armazenamento"}
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
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="ALM-01" className="pl-10 font-mono" {...field} />
                      </div>
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
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Almoxarifado Central" className="pl-10" {...field} />
                      </div>
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
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Sede - São Paulo" className="pl-10" {...field} />
                      </div>
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
              <DialogFooter className="gap-2 sm:gap-0">
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
