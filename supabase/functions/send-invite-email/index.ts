import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist of allowed app URLs to prevent phishing
const ALLOWED_APP_URLS = [
  "https://stockmastercms.com",
  "https://www.stockmastercms.com",
  "https://lvtzhdmmichasbwsszfk.lovableproject.com",
  "http://localhost:8080",
  "http://localhost:5173",
];

// Input validation schema
const InviteEmailSchema = z.object({
  email: z.string().email({ message: "Email inválido" }).max(255, "Email muito longo"),
  role: z.enum(["superadmin", "admin", "almoxarife", "operador", "auditor"], { 
    errorMap: () => ({ message: "Função inválida" }) 
  }),
  inviteId: z.string().uuid({ message: "ID do convite inválido" }),
  appUrl: z.string().url({ message: "URL inválida" }).max(500, "URL muito longa"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const body = await req.json();
    const validationResult = InviteEmailSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(", ");
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, role, inviteId, appUrl } = validationResult.data;

    // Validate appUrl is in the whitelist to prevent phishing
    const isAllowedUrl = ALLOWED_APP_URLS.some(allowed => 
      appUrl.toLowerCase().startsWith(allowed.toLowerCase())
    );

    if (!isAllowedUrl) {
      console.error('Invalid appUrl attempted:', appUrl);
      return new Response(
        JSON.stringify({ error: "URL de aplicação não permitida" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending invite email to:", email, "with role:", role);

    const acceptUrl = `${appUrl}/accept-invite?id=${encodeURIComponent(inviteId)}`;

    // Map role to Portuguese display name
    const roleDisplayNames: Record<string, string> = {
      superadmin: "Super Administrador",
      admin: "Administrador",
      almoxarife: "Almoxarife",
      operador: "Operador",
      auditor: "Auditor",
    };

    const roleDisplay = roleDisplayNames[role] || role;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "StockMaster <noreply@stockmastercms.com>",
        to: [email],
        subject: "Convite para StockMaster CMS",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Você foi convidado para StockMaster CMS</h1>
          <p style="color: #666; font-size: 16px;">
            Você recebeu um convite para se juntar ao StockMaster CMS como <strong>${roleDisplay}</strong>.
          </p>
          <p style="color: #666; font-size: 16px;">
            Para aceitar o convite e criar sua conta, clique no botão abaixo:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Aceitar Convite
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            Ou copie e cole este link no seu navegador:<br>
            <span style="color: #4F46E5;">${acceptUrl}</span>
          </p>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            Este convite expira em 7 dias.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
          Se você não esperava este convite, pode ignorar este email.
        </p>
      </div>
    `,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Resend API error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData.id);

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending invite email:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar convite" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
