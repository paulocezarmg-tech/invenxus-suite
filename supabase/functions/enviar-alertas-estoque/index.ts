import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { organization_id, limite_dias = 7 } = await req.json();

    console.log("Verificando alertas de estoque para organização:", organization_id);

    // Buscar previsões com dias restantes abaixo do limite
    const { data: previsoesAlerta, error: previsoesError } = await supabaseClient
      .from("previsoes_estoque")
      .select(`
        *,
        products:produto_id (name, sku)
      `)
      .eq("organization_id", organization_id)
      .lte("dias_restantes", limite_dias)
      .not("dias_restantes", "is", null)
      .order("dias_restantes", { ascending: true });

    if (previsoesError) throw previsoesError;

    if (!previsoesAlerta || previsoesAlerta.length === 0) {
      console.log("Nenhum produto em alerta");
      return new Response(
        JSON.stringify({ success: true, alertas_enviados: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar membros da organização
    const { data: members, error: membersError } = await supabaseClient
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization_id);

    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      console.log("Nenhum membro encontrado na organização");
      return new Response(
        JSON.stringify({ success: true, alertas_enviados: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar apenas admins dentre os membros
    const memberIds = members.map((m) => m.user_id);
    const { data: adminRoles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("user_id")
      .in("user_id", memberIds)
      .in("role", ["admin", "superadmin"]);

    if (rolesError) throw rolesError;

    // Buscar emails dos admins no auth.users
    const adminUserIds = adminRoles?.map((a) => a.user_id) || [];
    const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers();

    if (authError) throw authError;

    const adminEmails = authUsers.users
      .filter((u) => adminUserIds.includes(u.id))
      .map((u) => u.email)
      .filter((e) => e);

    if (adminEmails.length === 0) {
      console.log("Nenhum admin encontrado para enviar alertas");
      return new Response(
        JSON.stringify({ success: true, alertas_enviados: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preparar HTML do email com recomendações da IA
    const produtosHtml = previsoesAlerta
      .map(
        (p) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 16px; text-align: left;">
          <div style="font-weight: 600; color: #111827; font-size: 15px; margin-bottom: 4px;">
            ${p.products?.name || "N/A"}
          </div>
          <div style="color: #6b7280; font-size: 13px;">SKU: ${p.products?.sku || "-"}</div>
        </td>
        <td style="padding: 16px; text-align: center;">${Number(p.estoque_atual).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
        <td style="padding: 16px; text-align: center;">${Number(p.media_vendas_diaria).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
        <td style="padding: 16px; text-align: center; color: ${Number(p.dias_restantes) <= 3 ? "#ef4444" : "#f59e0b"}; font-weight: bold; font-size: 16px;">
          ${Math.floor(Number(p.dias_restantes))} dias
        </td>
        <td style="padding: 16px; text-align: center; color: #dc2626; font-weight: 600;">
          ${Number(p.perda_financeira || 0) > 0 ? `R$ ${Number(p.perda_financeira).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
        </td>
      </tr>
      <tr>
        <td colspan="5" style="padding: 12px 16px; background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="color: #10b981; font-size: 18px; margin-top: 2px;">🤖</div>
            <div>
              <div style="font-weight: 600; color: #10b981; font-size: 13px; margin-bottom: 4px;">Recomendação da IA:</div>
              <div style="color: #374151; font-size: 14px; line-height: 1.6;">${p.recomendacao || "Nenhuma recomendação disponível."}</div>
            </div>
          </div>
        </td>
      </tr>
    `
      )
      .join("");

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
            ⚠️ Alerta de Estoque Crítico
          </h1>
          <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 14px;">
            StockMaster CMS - Previsão Inteligente
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Olá! 👋
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            O sistema de IA detectou <strong style="color: #dc2626;">${previsoesAlerta.length} produto(s)</strong> com estoque crítico (menos de ${limite_dias} dias restantes).
          </p>
          
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Confira abaixo os detalhes e as <strong style="color: #10b981;">recomendações personalizadas da Inteligência Artificial</strong> para cada produto:
          </p>

          <!-- Tabela de Produtos -->
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #10b981;">
                <th style="padding: 12px; text-align: left; color: #ffffff; font-weight: 600; font-size: 14px;">Produto</th>
                <th style="padding: 12px; text-align: center; color: #ffffff; font-weight: 600; font-size: 14px;">Estoque</th>
                <th style="padding: 12px; text-align: center; color: #ffffff; font-weight: 600; font-size: 14px;">Média/Dia</th>
                <th style="padding: 12px; text-align: center; color: #ffffff; font-weight: 600; font-size: 14px;">Dias Restantes</th>
                <th style="padding: 12px; text-align: center; color: #ffffff; font-weight: 600; font-size: 14px;">Perda Estimada</th>
              </tr>
            </thead>
            <tbody>
              ${produtosHtml}
            </tbody>
          </table>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 6px;">
            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.7;">
              <strong>💡 Ação Recomendada:</strong> As sugestões acima foram geradas por nossa Inteligência Artificial com base no histórico real de vendas. Providencie o reabastecimento o quanto antes para evitar rupturas e perdas financeiras.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Acesse o painel de <strong>Previsão de Estoque com IA</strong> no StockMaster CMS para visualizar análises detalhadas e gráficos preditivos.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
            Este é um alerta automático do <strong>StockMaster CMS</strong>
          </p>
          <p style="color: #9ca3af; font-size: 11px; margin: 0;">
            Sistema de Gestão de Estoque com Inteligência Artificial • Previsões atualizadas diariamente
          </p>
        </div>

      </div>
    </body>
    </html>
    `;

    // Enviar emails usando a API do Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const emailsEnviados = [];
    
    for (const email of adminEmails) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "StockMaster CMS <onboarding@resend.dev>",
            to: [email],
            subject: `🚨 Alerta StockMaster: ${previsoesAlerta.length} produto(s) em estoque crítico com recomendações da IA`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          console.log("Email enviado para:", email);
          emailsEnviados.push(email);
        } else {
          const errorData = await emailResponse.text();
          console.error(`Erro ao enviar email para ${email}:`, errorData);
        }
      } catch (emailError) {
        console.error(`Erro ao enviar email para ${email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertas_enviados: emailsEnviados.length,
        produtos_em_alerta: previsoesAlerta.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao enviar alertas:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});