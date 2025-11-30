import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("Webhook Mercado Pago recebido:", body);

    const { id, type, action } = body as { id?: string; type?: string; action?: string };

    // Processar webhook de assinatura (preapproval)
    if (type === "preapproval" && id) {
      const detalhes = await buscarPreapproval(id);
      console.log("Detalhes da assinatura:", detalhes);

      if (!detalhes) {
        console.error("Não foi possível buscar detalhes da assinatura");
        return new Response(
          JSON.stringify({ received: true, error: "Detalhes não encontrados" }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Mapear status do Mercado Pago para status do sistema
      let systemStatus = "pending";
      if (detalhes.status === "authorized") {
        systemStatus = "active";
      } else if (detalhes.status === "cancelled") {
        systemStatus = "cancelled";
      } else if (detalhes.status === "paused") {
        systemStatus = "expired";
      }

      // Atualizar assinatura no banco
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({
          status: systemStatus,
          mp_status: detalhes.status,
          payment_status: detalhes.status === "authorized" ? "paid" : "pending",
          last_payment_date: detalhes.last_modified 
            ? new Date(detalhes.last_modified).toISOString().split('T')[0]
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("preapproval_id", id);

      if (updateError) {
        console.error("Erro ao atualizar assinatura:", updateError);
      } else {
        console.log(`Assinatura ${id} atualizada para status: ${systemStatus}`);
      }

      // Se for cancelamento, notificar usuário
      if (detalhes.status === "cancelled") {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("user_id, organization_id")
          .eq("preapproval_id", id)
          .single();

        if (subscription) {
          await supabase
            .from("notifications")
            .insert({
              organization_id: subscription.organization_id,
              user_id: subscription.user_id,
              title: "Assinatura Cancelada",
              message: "Sua assinatura foi cancelada. O acesso será mantido até o fim do período pago.",
              type: "warning",
            });
        }
      }
    }

    // Processar webhook de pagamento
    if (type === "payment" && id) {
      const detalhes = await buscarPayment(id);
      console.log("Detalhes do pagamento:", detalhes);

      if (!detalhes || !detalhes.preapproval_id) {
        console.log("Pagamento sem preapproval_id associado");
        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Buscar assinatura pelo preapproval_id
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id, user_id, organization_id")
        .eq("preapproval_id", detalhes.preapproval_id)
        .single();

      if (!subscription) {
        console.error("Assinatura não encontrada para preapproval_id:", detalhes.preapproval_id);
        return new Response(
          JSON.stringify({ received: true, error: "Assinatura não encontrada" }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Registrar histórico de pagamento
      await supabase.from("payment_history").insert({
        subscription_id: subscription.id,
        preapproval_id: detalhes.preapproval_id,
        payment_id: id,
        status: detalhes.status,
        amount: detalhes.transaction_amount || 0,
        payment_date: detalhes.date_approved 
          ? new Date(detalhes.date_approved).toISOString()
          : null,
        metadata: detalhes,
      });

      // Atualizar status da assinatura baseado no pagamento
      if (detalhes.status === "approved") {
        const nextRenewalDate = new Date();
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            payment_status: "paid",
            last_payment_date: new Date().toISOString().split('T')[0],
            renewal_date: nextRenewalDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        console.log(`Pagamento aprovado para assinatura ${subscription.id}`);

        // Notificar usuário do pagamento bem-sucedido
        await supabase.from("notifications").insert({
          organization_id: subscription.organization_id,
          user_id: subscription.user_id,
          title: "Pagamento Aprovado",
          message: "Seu pagamento foi aprovado com sucesso. Obrigado!",
          type: "success",
        });
      } else if (detalhes.status === "rejected" || detalhes.status === "cancelled") {
        await supabase
          .from("subscriptions")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        console.log(`Pagamento falhou para assinatura ${subscription.id}`);

        // Notificar usuário do pagamento falho
        await supabase.from("notifications").insert({
          organization_id: subscription.organization_id,
          user_id: subscription.user_id,
          title: "Falha no Pagamento",
          message: "Houve um problema com seu pagamento. Por favor, atualize seus dados de pagamento para evitar interrupção do serviço.",
          type: "error",
        });
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Erro no webhook MP:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno no webhook" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function buscarPreapproval(preapprovalId: string) {
  if (!MP_ACCESS_TOKEN) return null;

  try {
    const resp = await fetch(
      `https://api.mercadopago.com/preapproval/${preapprovalId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!resp.ok) {
      console.error("Erro ao buscar preapproval:", await resp.text());
      return null;
    }

    return await resp.json();
  } catch (err) {
    console.error("Erro ao buscar preapproval:", err);
    return null;
  }
}

async function buscarPayment(paymentId: string) {
  if (!MP_ACCESS_TOKEN) return null;

  try {
    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!resp.ok) {
      console.error("Erro ao buscar payment:", await resp.text());
      return null;
    }

    return await resp.json();
  } catch (err) {
    console.error("Erro ao buscar payment:", err);
    return null;
  }
}
