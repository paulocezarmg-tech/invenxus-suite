import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Método não permitido", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  if (!MP_ACCESS_TOKEN) {
    console.error("MP_ACCESS_TOKEN não configurado nas variáveis de ambiente");
    return new Response(
      JSON.stringify({ error: "Configuração incompleta do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Erro ao obter usuário:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));

    const {
      plan_id,
      customer_email,
      amount,
      frequency = 1,
      frequency_type = "months",
      description = "Assinatura StockMaster",
      back_url,
    } = body;

    if (!customer_email || !amount || !plan_id) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios: customer_email, amount, plan_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados da organização do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: "Organização não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const external_reference = `org_${profile.organization_id}_plan_${plan_id}`;

    const payload = {
      reason: description,
      external_reference,
      payer_email: customer_email,
      auto_recurring: {
        frequency,
        frequency_type,
        transaction_amount: amount,
        currency_id: "BRL",
        start_date: new Date().toISOString(),
      },
      back_url: back_url || `${req.headers.get('origin') || ''}/assinatura`,
      status: "pending",
    };

    console.log("Criando assinatura no Mercado Pago:", payload);

    const mpResponse = await fetch(
      "https://api.mercadopago.com/preapproval",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro Mercado Pago:", data);
      return new Response(
        JSON.stringify({
          error: "Erro ao criar assinatura no Mercado Pago",
          details: data,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Assinatura criada com sucesso:", data);

    // Criar ou atualizar registro na tabela subscriptions
    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        organization_id: profile.organization_id,
        plan_id,
        preapproval_id: data.id,
        status: "pending",
        mp_status: data.status,
        start_date: new Date().toISOString().split('T')[0],
        renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_status: "pending",
      }, {
        onConflict: "organization_id",
      });

    if (subError) {
      console.error("Erro ao salvar assinatura no banco:", subError);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao criar assinatura" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
