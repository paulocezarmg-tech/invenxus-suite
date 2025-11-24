import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Building2, Upload, History } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useOrganization } from "@/hooks/useOrganization";
import { formatPhone } from "@/lib/formatters";
import { validateCNPJ, maskCNPJ, formatCNPJ } from "@/lib/cnpj-validator";
import { SupplierPurchaseHistory } from "./SupplierPurchaseHistory";
import { ScrollArea } from "@/components/ui/scroll-area";

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  contact: z.string().trim().max(200, "Contato deve ter no máximo 200 caracteres").optional(),
  email: z.string().trim().email("Email inválido").max(255, "Email deve ter no máximo 255 caracteres").optional().or(z.literal("")),
  phone: z.string().trim().max(20, "Telefone deve ter no máximo 20 caracteres").optional(),
  cnpj: z.string().trim().optional().refine(
    (val) => !val || val === "" || validateCNPJ(val),
    { message: "CNPJ inválido" }
  ),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export function SuppliersSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<any>(null);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contact: "",
      email: "",
      phone: "",
      cnpj: "",
    },
  });

  // Check user role
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-suppliers"],
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

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (editingSupplier) {
      form.reset({
        name: editingSupplier.name,
        contact: editingSupplier.contact || "",
        email: editingSupplier.email || "",
        phone: editingSupplier.phone || "",
        cnpj: editingSupplier.cnpj || "",
      });
      setLogoPreview(editingSupplier.logo_url || null);
      setLogoFile(null);
    } else {
      form.reset({
        name: "",
        contact: "",
        email: "",
        phone: "",
        cnpj: "",
      });
      setLogoPreview(null);
      setLogoFile(null);
    }
  }, [editingSupplier, form]);

  const handleOpenDialog = (supplier?: any) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (supplierId: string): Promise<string | null> => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${supplierId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('supplier-logos')
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('supplier-logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onSubmit = async (data: SupplierFormData) => {
    setIsSubmitting(true);
    try {
      if (!organizationId) throw new Error("Organization not found");
      
      let logoUrl = editingSupplier?.logo_url || null;

      const supplierData = {
        name: data.name,
        contact: data.contact || null,
        email: data.email || null,
        phone: data.phone || null,
        cnpj: data.cnpj ? data.cnpj.replace(/\D/g, "") : null,
        organization_id: organizationId,
        logo_url: logoUrl,
      };

      if (editingSupplier) {
        // Upload new logo if selected
        if (logoFile) {
          logoUrl = await uploadLogo(editingSupplier.id);
          supplierData.logo_url = logoUrl;
        }
        
        const { error } = await supabase.from("suppliers").update(supplierData).eq("id", editingSupplier.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        // Insert first to get the ID
        const { data: newSupplier, error } = await supabase
          .from("suppliers")
          .insert(supplierData)
          .select()
          .single();
        
        if (error) throw error;
        
        // Upload logo if selected
        if (logoFile && newSupplier) {
          logoUrl = await uploadLogo(newSupplier.id);
          if (logoUrl) {
            await supabase
              .from("suppliers")
              .update({ logo_url: logoUrl })
              .eq("id", newSupplier.id);
          }
        }
        
        toast.success("Fornecedor criado");
      }
      
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      form.reset();
      setLogoFile(null);
      setLogoPreview(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este fornecedor?")) return;

    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Fornecedor excluído");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
            Novo Fornecedor
          </Button>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Logo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              {userRole !== "operador" && <TableHead className="w-[120px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : suppliers && suppliers.length > 0 ? (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={supplier.logo_url || ""} alt={supplier.name} />
                      <AvatarFallback>
                        <Building2 className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {supplier.cnpj ? formatCNPJ(supplier.cnpj) : "-"}
                  </TableCell>
                  <TableCell>{supplier.contact || "-"}</TableCell>
                  <TableCell>{supplier.email || "-"}</TableCell>
                  <TableCell>{formatPhone(supplier.phone)}</TableCell>
                  <TableCell>
                    {supplier.active ? (
                      <Badge className="bg-success">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  {userRole !== "operador" && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setSelectedSupplierForHistory(supplier);
                            setHistoryDialogOpen(true);
                          }}
                          title="Ver histórico"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum fornecedor encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Atualize as informações" : "Adicione um novo fornecedor"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Logo da Empresa</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={logoPreview || ""} alt="Logo" />
                    <AvatarFallback>
                      <Building2 className="h-10 w-10" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: JPG, PNG, WEBP (máx. 5MB)
                    </p>
                  </div>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="00.000.000/0000-00" 
                        {...field}
                        onChange={(e) => {
                          const masked = maskCNPJ(e.target.value);
                          field.onChange(masked);
                        }}
                        maxLength={18}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pessoa de Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contato@fornecedor.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(11) 98765-4321" 
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          let formatted = '';
                          if (value.length > 0) {
                            formatted = '(' + value.substring(0, 2);
                            if (value.length > 2) {
                              formatted += ')' + value.substring(2, 7);
                            }
                            if (value.length > 7) {
                              formatted += '-' + value.substring(7, 11);
                            }
                          }
                          field.onChange(formatted);
                        }}
                        maxLength={14}
                      />
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
                  {isSubmitting ? "Salvando..." : editingSupplier ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Histórico de Compras</DialogTitle>
            <DialogDescription>
              Histórico de compras do fornecedor {selectedSupplierForHistory?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {selectedSupplierForHistory && (
              <SupplierPurchaseHistory 
                supplierId={selectedSupplierForHistory.id}
                supplierName={selectedSupplierForHistory.name}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
