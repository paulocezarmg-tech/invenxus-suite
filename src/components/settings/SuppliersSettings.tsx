import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Building2, Upload, History, Search, Phone, Mail, User } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredSuppliers = suppliers?.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.cnpj?.includes(searchTerm.replace(/\D/g, ''))
  );

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

  const formatPhoneMask = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    let formatted = '';
    if (numbers.length > 0) {
      formatted = '(' + numbers.substring(0, 2);
      if (numbers.length > 2) {
        formatted += ') ' + numbers.substring(2, 7);
      }
      if (numbers.length > 7) {
        formatted += '-' + numbers.substring(7, 11);
      }
    }
    return formatted;
  };

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Fornecedores</CardTitle>
                <CardDescription>Gerencie seus fornecedores e parceiros</CardDescription>
              </div>
            </div>
            {userRole !== "operador" && (
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Fornecedor
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-border/50"
            />
          </div>

          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[60px] text-muted-foreground font-medium">Logo</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Nome</TableHead>
                  <TableHead className="text-muted-foreground font-medium">CNPJ</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Contato</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Email</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Telefone</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                  {userRole !== "operador" && <TableHead className="w-[120px] text-muted-foreground font-medium">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers && filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border-border/50">
                      <TableCell>
                        <Avatar className="h-10 w-10 border border-border/50">
                          <AvatarImage src={supplier.logo_url || ""} alt={supplier.name} />
                          <AvatarFallback className="bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>
                        {supplier.cnpj ? (
                          <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                            {formatCNPJ(supplier.cnpj)}
                          </code>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.contact ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>{supplier.contact}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.email ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[150px]">{supplier.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{formatPhone(supplier.phone)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.active ? (
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
                              onClick={() => {
                                setSelectedSupplierForHistory(supplier);
                                setHistoryDialogOpen(true);
                              }}
                              title="Ver histórico"
                              className="h-8 w-8 hover:bg-primary/10"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenDialog(supplier)}
                              className="h-8 w-8 hover:bg-primary/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(supplier.id)}
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
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Building2 className="h-8 w-8 text-muted-foreground/50" />
                        <span>Nenhum fornecedor encontrado</span>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Atualize as informações do fornecedor" : "Adicione um novo fornecedor"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Logo da Empresa</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-border/50">
                    <AvatarImage src={logoPreview || ""} alt="Logo" />
                    <AvatarFallback className="bg-primary/10">
                      <Building2 className="h-8 w-8 text-primary" />
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
                      JPG, PNG, WEBP (máx. 5MB)
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
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Nome do fornecedor" className="pl-10" {...field} />
                      </div>
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
                        className="font-mono"
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
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="João Silva" className="pl-10" {...field} />
                      </div>
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
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="contato@fornecedor.com" className="pl-10" {...field} />
                      </div>
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
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="(00) 00000-0000" 
                          className="pl-10"
                          {...field}
                          onChange={(e) => {
                            field.onChange(formatPhoneMask(e.target.value));
                          }}
                          maxLength={15}
                        />
                      </div>
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
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-5 w-5 text-primary" />
              </div>
              Histórico de Compras
            </DialogTitle>
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
