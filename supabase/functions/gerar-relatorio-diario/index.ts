import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função auxiliar para gerar HTML personalizado
function generateCustomEmailHTML({ org, userConfig, criticalProducts, previsoes, compras, vendas, saldo, valorEstoque, formatCurrency }: any) {
  const sections: string[] = [];

  // Cabeçalho sempre presente
  const header = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .section { background: #f8f9fa; margin: 20px 0; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
        .section h2 { margin-top: 0; color: #667eea; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #667eea; color: white; }
        .metric { display: inline-block; background: white; padding: 15px 25px; margin: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        .warning { color: #f59e0b; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Relatório Diário de Estoque</h1>
          <p>${org.name}</p>
          <p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
  `;

  // Seção Financeira
  if (userConfig.incluir_financeiro) {
    sections.push(`
      <div class="section">
        <h2>💰 Resumo Financeiro - Dia Anterior</h2>
        <div style="text-align: center;">
          <div class="metric">
            <div class="metric-label">Total Vendido</div>
            <div class="metric-value positive">${formatCurrency(vendas)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Total Comprado</div>
            <div class="metric-value">${formatCurrency(compras)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Saldo</div>
            <div class="metric-value ${saldo >= 0 ? 'positive' : 'negative'}">${formatCurrency(saldo)}</div>
          </div>
          ${userConfig.incluir_valor_estoque ? `
          <div class="metric">
            <div class="metric-label">Valor em Estoque</div>
            <div class="metric-value">${formatCurrency(valorEstoque)}</div>
          </div>
          ` : ''}
        </div>
      </div>
    `);
  } else if (userConfig.incluir_valor_estoque) {
    // Só valor de estoque
    sections.push(`
      <div class="section">
        <h2>📦 Valor Total em Estoque</h2>
        <div style="text-align: center;">
          <div class="metric">
            <div class="metric-label">Valor em Estoque</div>
            <div class="metric-value">${formatCurrency(valorEstoque)}</div>
          </div>
        </div>
      </div>
    `);
  }

  // Produtos Críticos
  if (userConfig.incluir_estoque_critico && criticalProducts && criticalProducts.length > 0) {
    sections.push(`
      <div class="section">
        <h2>⚠️ Produtos Críticos (${criticalProducts.length})</h2>
        <p>Produtos abaixo do estoque mínimo:</p>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd Atual</th>
              <th>Qtd Mínima</th>
            </tr>
          </thead>
          <tbody>
            ${criticalProducts.map((p: any) => `
              <tr>
                <td>${p.name}</td>
                <td class="warning">${p.quantity}</td>
                <td>${p.min_quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `);
  }

  // Previsões
  if (userConfig.incluir_previsoes && previsoes && previsoes.length > 0) {
    sections.push(`
      <div class="section">
        <h2>🧠 Previsão de Estoque (IA)</h2>
        <p>Produtos em risco de ruptura nos próximos 7 dias:</p>
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Dias Restantes</th>
              <th>Estoque Atual</th>
              <th>Média Diária</th>
              <th>Recomendação</th>
            </tr>
          </thead>
          <tbody>
            ${previsoes.map((p: any) => `
              <tr>
                <td>${p.products?.name || 'N/A'}</td>
                <td class="${p.dias_restantes <= 3 ? 'negative' : 'warning'}">${p.dias_restantes.toFixed(1)} dias</td>
                <td>${p.estoque_atual}</td>
                <td>${p.media_vendas_diaria.toFixed(2)}</td>
                <td>${p.recomendacao || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `);
  }

  const footer = `
        <div class="footer">
          <p>Este é um relatório automático gerado pelo sistema StockMaster.</p>
          <p>Para visualizar informações detalhadas, acesse o sistema.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return header + sections.join('') + footer;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Iniciando geração de relatório diário...");

    // Buscar todas as organizações ativas
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("active", true);

    if (orgError) throw orgError;

    for (const org of organizations || []) {
      console.log(`Processando organização: ${org.name}`);

      // Buscar admins da organização
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "superadmin"]);

      if (!adminRoles || adminRoles.length === 0) continue;

      const adminIds = adminRoles.map(r => r.user_id);

      const { data: adminMembers } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org.id)
        .in("user_id", adminIds);

      if (!adminMembers || adminMembers.length === 0) continue;

      // Buscar emails dos admins
      const { data: profiles } = await supabase
        .from("profiles")
        .select("name, user_id")
        .in("user_id", adminMembers.map(m => m.user_id));

      // Buscar emails do auth
      const emails: string[] = [];
      for (const profile of profiles || []) {
        const { data: { user } } = await supabase.auth.admin.getUserById(profile.user_id);
        if (user?.email) emails.push(user.email);
      }

      if (emails.length === 0) continue;

      // Buscar configurações de cada admin
      const userConfigs = new Map();
      for (const profile of profiles || []) {
        const { data: userConfig } = await supabase
          .from("relatorio_configuracoes")
          .select("*")
          .eq("user_id", profile.user_id)
          .eq("organization_id", org.id)
          .maybeSingle();
        
        // Configuração padrão se não existir
        userConfigs.set(profile.user_id, userConfig || {
          incluir_financeiro: true,
          incluir_estoque_critico: true,
          incluir_previsoes: true,
          incluir_valor_estoque: true,
        });
      }

      // 1. PRODUTOS CRÍTICOS
      const { data: criticalProducts } = await supabase
        .from("products")
        .select("name, quantity, min_quantity")
        .eq("organization_id", org.id)
        .filter("quantity", "lte", "min_quantity")
        .order("quantity", { ascending: true })
        .limit(10);

      // 2. PREVISÕES DE ESTOQUE (risco de ruptura)
      const { data: previsoes } = await supabase
        .from("previsoes_estoque")
        .select(`
          dias_restantes,
          estoque_atual,
          media_vendas_diaria,
          recomendacao,
          products:produto_id (name)
        `)
        .eq("organization_id", org.id)
        .lte("dias_restantes", 7)
        .not("dias_restantes", "is", null)
        .order("dias_restantes", { ascending: true });

      // 3. VENDAS/COMPRAS DO DIA ANTERIOR
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: movements } = await supabase
        .from("movements")
        .select(`
          type,
          quantity,
          products (preco_venda, cost, custo_unitario),
          kits (preco_venda, custos_adicionais)
        `)
        .eq("organization_id", org.id)
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", today.toISOString());

      // Calcular totais de vendas e compras
      const compras = movements?.filter(m => m.type === "IN").reduce((acc, m: any) => {
        const productPrice = m.products?.cost ?? m.products?.custo_unitario ?? 0;
        const kitCost = m.kits?.custos_adicionais
          ? (Array.isArray(m.kits.custos_adicionais)
              ? m.kits.custos_adicionais.reduce((s: number, c: any) => s + Number(c.valor || 0), 0)
              : 0)
          : 0;
        const unitCost = productPrice + kitCost;
        return acc + unitCost * Number(m.quantity || 0);
      }, 0) || 0;

      const vendas = movements?.filter(m => m.type === "OUT").reduce((acc, m: any) => {
        const salePrice = m.products?.preco_venda ?? m.kits?.preco_venda ?? 0;
        return acc + salePrice * Number(m.quantity || 0);
      }, 0) || 0;

      const saldo = vendas - compras;

      // 4. VALOR TOTAL EM ESTOQUE
      const { data: allProducts } = await supabase
        .from("products")
        .select("quantity, cost")
        .eq("organization_id", org.id);

      const valorEstoque = allProducts?.reduce((sum, p) => 
        sum + Number(p.quantity) * Number(p.cost), 0) || 0;

      // Gerar HTML do email
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(value);
      };

      const emailHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .section { background: #f8f9fa; margin: 20px 0; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
            .section h2 { margin-top: 0; color: #667eea; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #667eea; color: white; }
            .metric { display: inline-block; background: white; padding: 15px 25px; margin: 10px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
            .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
            .positive { color: #10b981; }
            .negative { color: #ef4444; }
            .warning { color: #f59e0b; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Relatório Diário de Estoque</h1>
              <p>${org.name}</p>
              <p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div class="section">
              <h2>💰 Resumo Financeiro - Dia Anterior</h2>
              <div style="text-align: center;">
                <div class="metric">
                  <div class="metric-label">Total Vendido</div>
                  <div class="metric-value positive">${formatCurrency(vendas)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Total Comprado</div>
                  <div class="metric-value">${formatCurrency(compras)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Saldo</div>
                  <div class="metric-value ${saldo >= 0 ? 'positive' : 'negative'}">${formatCurrency(saldo)}</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Valor em Estoque</div>
                  <div class="metric-value">${formatCurrency(valorEstoque)}</div>
                </div>
              </div>
            </div>

            ${criticalProducts && criticalProducts.length > 0 ? `
              <div class="section">
                <h2>⚠️ Produtos Críticos (${criticalProducts.length})</h2>
                <p>Produtos abaixo do estoque mínimo:</p>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd Atual</th>
                      <th>Qtd Mínima</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${criticalProducts.map(p => `
                      <tr>
                        <td>${p.name}</td>
                        <td class="warning">${p.quantity}</td>
                        <td>${p.min_quantity}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${previsoes && previsoes.length > 0 ? `
              <div class="section">
                <h2>🧠 Previsão de Estoque (IA)</h2>
                <p>Produtos em risco de ruptura nos próximos 7 dias:</p>
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Dias Restantes</th>
                      <th>Estoque Atual</th>
                      <th>Média Diária</th>
                      <th>Recomendação</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${previsoes.map((p: any) => `
                      <tr>
                        <td>${p.products?.name || 'N/A'}</td>
                        <td class="${p.dias_restantes <= 3 ? 'negative' : 'warning'}">${p.dias_restantes.toFixed(1)} dias</td>
                        <td>${p.estoque_atual}</td>
                        <td>${p.media_vendas_diaria.toFixed(2)}</td>
                        <td>${p.recomendacao || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <div class="footer">
              <p>Este é um relatório automático gerado pelo sistema StockMaster.</p>
              <p>Para visualizar informações detalhadas, acesse o sistema.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Enviar email para todos os admins
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const profile = profiles?.[i];
        const userConfig = userConfigs.get(profile?.user_id);
        
        // Gerar HTML personalizado baseado nas preferências do usuário
        const customHTML = generateCustomEmailHTML({
          org,
          userConfig,
          criticalProducts,
          previsoes,
          compras,
          vendas,
          saldo,
          valorEstoque,
          formatCurrency,
        });

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "StockMaster <onboarding@resend.dev>",
              to: email,
              subject: `📊 Relatório Diário - ${org.name} - ${new Date().toLocaleDateString('pt-BR')}`,
              html: customHTML,
            }),
          });

          if (emailResponse.ok) {
            console.log(`Email enviado para: ${email}`);
          } else {
            const errorText = await emailResponse.text();
            console.error(`Erro ao enviar email para ${email}:`, errorText);
          }
        } catch (emailError) {
          console.error(`Erro ao enviar email para ${email}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Relatórios enviados com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao gerar relatório diário:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
