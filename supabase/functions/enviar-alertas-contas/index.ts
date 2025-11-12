import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Conta {
  id: string;
  tipo: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: string;
  status: string;
  organization_id: string;
  anexos: Array<{ name: string; url: string; path: string }>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando verificação de contas próximas do vencimento...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar contas pendentes que vencem nos próximos 3 dias
    const hoje = new Date();
    const daquiATresDias = new Date();
    daquiATresDias.setDate(hoje.getDate() + 3);

    const { data: contas, error: contasError } = await supabase
      .from("contas")
      .select("*")
      .eq("status", "Pendente")
      .gte("data_vencimento", hoje.toISOString().split("T")[0])
      .lte("data_vencimento", daquiATresDias.toISOString().split("T")[0]);

    if (contasError) {
      console.error("Erro ao buscar contas:", contasError);
      throw contasError;
    }

    console.log(`Encontradas ${contas?.length || 0} contas próximas do vencimento`);

    if (!contas || contas.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma conta próxima do vencimento encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Agrupar contas por organização
    const contasPorOrg = contas.reduce((acc: Record<string, Conta[]>, conta) => {
      if (!acc[conta.organization_id]) {
        acc[conta.organization_id] = [];
      }
      acc[conta.organization_id].push(conta as Conta);
      return acc;
    }, {});

    const emailsEnviados: string[] = [];

    // Para cada organização, buscar admins e enviar email
    for (const [orgId, contasOrg] of Object.entries(contasPorOrg)) {
      console.log(`Processando ${contasOrg.length} contas da organização ${orgId}`);

      // Buscar membros da organização
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId);

      if (membersError || !members) {
        console.error(`Erro ao buscar membros da organização ${orgId}:`, membersError);
        continue;
      }

      // Buscar roles dos membros
      const userIds = members.map(m => m.user_id);
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .in("role", ["admin", "superadmin"]);

      if (rolesError || !userRoles) {
        console.error(`Erro ao buscar roles da organização ${orgId}:`, rolesError);
        continue;
      }

      const adminIds = userRoles.map(ur => ur.user_id);

      // Buscar emails dos admins
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", adminIds);

      if (profilesError || !profiles || profiles.length === 0) {
        console.error(`Erro ao buscar perfis da organização ${orgId}:`, profilesError);
        continue;
      }

      // Buscar emails dos usuários
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError || !users) {
        console.error(`Erro ao buscar usuários:`, usersError);
        continue;
      }

      const adminEmails = users
        .filter(user => adminIds.includes(user.id) && user.email)
        .map(user => user.email) as string[];

      if (adminEmails.length === 0) {
        console.log(`Nenhum admin com email encontrado para organização ${orgId}`);
        continue;
      }

      // Gerar HTML do email
      const htmlContas = contasOrg.map(conta => {
        const diasRestantes = Math.ceil(
          (new Date(conta.data_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const anexosHtml = conta.anexos && conta.anexos.length > 0
          ? `
            <div style="margin-top: 10px;">
              <strong>📎 Anexos:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                ${conta.anexos.map(anexo => `
                  <li>
                    <a href="${anexo.url}" style="color: #2563eb; text-decoration: none;">
                      ${anexo.name}
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          `
          : '';

        return `
          <div style="background: #f8fafc; border-left: 4px solid ${conta.tipo === 'Pagar' ? '#dc2626' : '#16a34a'}; padding: 15px; margin: 10px 0; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">
                  ${conta.tipo === 'Pagar' ? '💸' : '💰'} ${conta.descricao}
                </h3>
                <p style="margin: 5px 0; color: #64748b; font-size: 14px;">
                  <strong>Tipo:</strong> Conta a ${conta.tipo}<br/>
                  <strong>Categoria:</strong> ${conta.categoria}<br/>
                  <strong>Valor:</strong> R$ ${conta.valor.toFixed(2)}<br/>
                  <strong>Vencimento:</strong> ${new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}<br/>
                  <strong>⏰ Vence em:</strong> <span style="color: ${diasRestantes <= 1 ? '#dc2626' : '#f59e0b'}; font-weight: bold;">${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}</span>
                </p>
                ${anexosHtml}
              </div>
            </div>
          </div>
        `;
      }).join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Alerta de Contas a Vencer</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📅 Alerta de Contas a Vencer</h1>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; color: #475569; margin-bottom: 20px;">
                Olá! Você tem <strong>${contasOrg.length}</strong> conta(s) com vencimento próximo nos próximos 3 dias.
              </p>

              <div style="margin: 20px 0;">
                ${htmlContas}
              </div>

              <div style="margin-top: 30px; padding: 20px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  💡 <strong>Dica:</strong> Mantenha suas contas em dia para evitar atrasos e multas. 
                  ${contasOrg.some(c => c.anexos && c.anexos.length > 0) ? 'Os anexos (boletos, comprovantes) estão disponíveis para download.' : ''}
                </p>
              </div>

              <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0;">
                  Este é um email automático do <strong>StockMaster CMS</strong>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Enviar email para todos os admins
      for (const email of adminEmails) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "StockMaster CMS <onboarding@resend.dev>",
              to: [email],
              subject: `⚠️ ${contasOrg.length} conta(s) a vencer nos próximos 3 dias`,
              html: emailHtml,
            }),
          });

          if (!emailResponse.ok) {
            throw new Error(`HTTP error! status: ${emailResponse.status}`);
          }

          emailsEnviados.push(email);
          console.log(`Email enviado para ${email}`);
        } catch (emailError) {
          console.error(`Erro ao enviar email para ${email}:`, emailError);
        }
      }
    }

    console.log(`Processo finalizado. ${emailsEnviados.length} emails enviados.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${emailsEnviados.length} alertas enviados com sucesso`,
        emails: emailsEnviados,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao processar alertas de contas:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
