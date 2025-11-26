import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando envio de relatórios semanais...");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração de email não encontrada" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todos os usuários ativos
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, name, organization_id')
      .limit(1000);

    if (profilesError) {
      console.error("Erro ao buscar perfis:", profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      console.log("Nenhum usuário encontrado");
      return new Response(
        JSON.stringify({ message: "Nenhum usuário para enviar relatório" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${profiles.length} usuários`);

    // Calcular período (últimos 7 dias)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    let emailsSent = 0;
    let emailsFailed = 0;

    // Para cada usuário, gerar análise e enviar email
    for (const profile of profiles) {
      try {
        // Buscar email do usuário
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        
        if (!authData?.user?.email) {
          console.log(`Usuário ${profile.name} sem email`);
          continue;
        }

        const userEmail = authData.user.email;

        // Buscar dados financeiros do período
        const { data: financialData } = await supabaseAdmin
          .from('financeiro')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .gte('data', startDateStr)
          .lte('data', endDateStr);

        if (!financialData || financialData.length === 0) {
          console.log(`Usuário ${profile.name} sem movimentações no período`);
          continue;
        }

        // Calcular métricas básicas
        const vendas = financialData.filter(item => item.tipo === 'saida');
        const totalFaturamento = vendas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
        const totalCusto = financialData.reduce((sum, item) => sum + Number(item.custo_total || 0), 0);
        const lucroLiquido = totalFaturamento - totalCusto;

        // Gerar análise simplificada via IA
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        
        const prompt = `Gere um resumo executivo semanal profissional e motivacional dos dados financeiros:

Período: ${startDateStr} a ${endDateStr}
- Faturamento: R$ ${totalFaturamento.toFixed(2)}
- Custos: R$ ${totalCusto.toFixed(2)}
- Lucro Líquido: R$ ${lucroLiquido.toFixed(2)}
- Vendas realizadas: ${vendas.length}

Gere um texto de 3-4 parágrafos:
1. Resumo geral da semana
2. Destaque positivo
3. Recomendação para a próxima semana

Use tom profissional mas motivacional. Inclua alguns emojis relevantes.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 800,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`Erro ao gerar análise para ${profile.name}:`, aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const analysis = aiData.choices?.[0]?.message?.content || "Análise indisponível";

        // Enviar email
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: "StockMaster <onboarding@resend.dev>",
            to: [userEmail],
            subject: `📊 Relatório Semanal Financeiro - ${startDateStr} a ${endDateStr}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📊 Relatório Semanal Financeiro</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0;">
                  ${startDateStr} a ${endDateStr}
                </p>
              </div>
              
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; margin-bottom: 20px;">Olá, ${profile.name}!</p>
                
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h2 style="color: #111827; font-size: 18px; margin: 0 0 15px 0;">Resumo da Semana</h2>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Faturamento Total:</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10b981;">
                        R$ ${totalFaturamento.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Custos Totais:</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #ef4444;">
                        R$ ${totalCusto.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Lucro Líquido:</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${lucroLiquido >= 0 ? '#10b981' : '#ef4444'};">
                        R$ ${lucroLiquido.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Vendas Realizadas:</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">
                        ${vendas.length}
                      </td>
                    </tr>
                  </table>
                </div>

                <div style="margin: 25px 0;">
                  <h2 style="color: #111827; font-size: 18px; margin: 0 0 15px 0;">💡 Análise Inteligente</h2>
                  <div style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${analysis}</div>
                </div>

                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #1e40af; font-size: 14px;">
                    💡 <strong>Dica:</strong> Acesse o painel para visualizar análises mais detalhadas e gráficos interativos.
                  </p>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    Este é um relatório automático gerado pelo StockMaster CMS
                  </p>
                </div>
              </div>
            </div>
          `,
          }),
        });

        const emailData = await emailResponse.json();

        if (!emailResponse.ok || emailData.error) {
          console.error(`Erro ao enviar email para ${userEmail}:`, emailData.error);
          emailsFailed++;
        } else {
          console.log(`Email enviado com sucesso para ${userEmail}`);
          emailsSent++;
        }

        // Aguardar um pouco entre envios para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Erro ao processar usuário ${profile.name}:`, error);
        emailsFailed++;
      }
    }

    console.log(`Processo finalizado. Enviados: ${emailsSent}, Falhados: ${emailsFailed}`);

    return new Response(
      JSON.stringify({ 
        message: "Processo finalizado",
        emailsSent,
        emailsFailed 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao enviar relatórios" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
