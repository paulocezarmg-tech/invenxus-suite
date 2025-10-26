import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export function LocationsSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleOpenDialog = (location?: any) => {
    if (location) {
      setEditingLocation(location);
      setCode(location.code);
      setName(location.name);
      setAddress(location.address || "");
      setRegion(location.region || "");
    } else {
      setEditingLocation(null);
      setCode("");
      setName("");
      setAddress("");
      setRegion("");
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        code,
        name,
        address: address || null,
        region: region || null,
      };

      if (editingLocation) {
        const { error } = await supabase.from("locations").update(data).eq("id", editingLocation.id);
        if (error) throw error;
        toast.success("Local atualizado");
      } else {
        const { error } = await supabase.from("locations").insert(data);
        if (error) throw error;
        toast.success("Local criado");
      }
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setDialogOpen(false);
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
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Local
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ALM-01"
              />
            </div>
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Almoxarifado Central"
              />
            </div>
            <div>
              <Label htmlFor="region">Região</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Sede - São Paulo"
              />
            </div>
            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua exemplo, 123"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editingLocation ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
