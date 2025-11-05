import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateOrganizationRequest {
  organizationName: string;
  organizationSlug: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      organizationName,
      organizationSlug,
      adminName,
      adminEmail,
      adminPhone,
    }: CreateOrganizationRequest = await req.json();

    console.log("Creating organization:", organizationName, "with admin:", adminEmail);

    // Create admin Supabase client with service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate temporary password
    const temporaryPassword = `${organizationSlug}${Math.random().toString(36).substring(2, 10)}`;

    // 1. Create the organization
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: organizationName,
        slug: organizationSlug,
        active: true,
      })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organization:", orgError);
      throw new Error(`Erro ao criar organização: ${orgError.message}`);
    }

    console.log("Organization created:", organization.id);

    // 2. Create the admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        phone: adminPhone,
      },
    });

    if (authError || !authData.user) {
      console.error("Error creating admin user:", authError);
      // Rollback: delete organization
      await supabaseAdmin.from("organizations").delete().eq("id", organization.id);
      throw new Error(`Erro ao criar usuário: ${authError?.message || "Usuário não criado"}`);
    }

    console.log("Admin user created:", authData.user.id);

    // 3. Create organization member
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: authData.user.id,
      });

    if (memberError) {
      console.error("Error creating organization member:", memberError);
      throw new Error(`Erro ao associar usuário à organização: ${memberError.message}`);
    }

    // 4. Create user role as admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "admin",
      });

    if (roleError) {
      console.error("Error creating user role:", roleError);
      throw new Error(`Erro ao criar role de admin: ${roleError.message}`);
    }

    // 5. Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: authData.user.id,
        name: adminName,
        phone: adminPhone || null,
        organization_id: organization.id,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      throw new Error(`Erro ao criar perfil: ${profileError.message}`);
    }

    console.log("User setup complete, sending email...");

    // 6. Send email with credentials
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "StockMaster <noreply@stockmastercms.com>",
        to: [adminEmail],
        subject: "Bem-vindo ao StockMaster CMS - Suas credenciais de acesso",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Bem-vindo ao StockMaster CMS!</h1>
            <p style="color: #666; font-size: 16px;">
              Olá ${adminName},
            </p>
            <p style="color: #666; font-size: 16px;">
              Uma conta de administrador foi criada para você na organização <strong>${organizationName}</strong>.
            </p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #333; margin-top: 0;">Suas credenciais de acesso:</h2>
              <p style="color: #666; margin: 10px 0;">
                <strong>Email:</strong> ${adminEmail}
              </p>
              <p style="color: #666; margin: 10px 0;">
                <strong>Senha temporária:</strong> <code style="background: #fff; padding: 5px 10px; border-radius: 4px;">${temporaryPassword}</code>
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${SUPABASE_URL.replace(/\.supabase\.co$/, '.lovableproject.com')}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Acessar Plataforma
              </a>
            </div>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              <strong>Importante:</strong> Recomendamos que você altere sua senha após o primeiro acesso.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              Este é um email automático. Por favor, não responda.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Error sending email:", error);
      // Don't fail the entire operation if email fails
      console.warn("Organization and user created successfully, but email failed to send");
    } else {
      console.log("Email sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizationId: organization.id,
        userId: authData.user.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in create-organization function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
