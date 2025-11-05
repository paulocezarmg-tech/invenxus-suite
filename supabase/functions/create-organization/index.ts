import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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

    console.log("Creating organization:", organizationName, "with admin invite for:", adminEmail);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the current user (superadmin creating the organization)
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    const { data: { user: currentUser } } = await supabaseAdmin.auth.getUser(token!);
    
    if (!currentUser) {
      throw new Error("Usuário não autenticado");
    }

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
      
      if (orgError.code === "23505" && orgError.message.includes("organizations_slug_key")) {
        throw new Error("Já existe uma organização com este slug. Por favor, escolha outro identificador único.");
      }
      
      throw new Error(`Erro ao criar organização: ${orgError.message}`);
    }

    console.log("Organization created:", organization.id);

    // 2. Create an invite for the admin user
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .insert({
        email: adminEmail,
        role: "admin",
        organization_id: organization.id,
        created_by: currentUser.id,
        status: "pending",
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      // Rollback: delete organization
      await supabaseAdmin.from("organizations").delete().eq("id", organization.id);
      throw new Error(`Erro ao criar convite: ${inviteError.message}`);
    }

    console.log("Invite created:", invite.id);

    // 3. Get the app URL from the request origin
    const origin = req.headers.get("origin") || SUPABASE_URL.replace(/\.supabase\.co$/, '.lovableproject.com');

    // 4. Send the invite email
    const { error: emailError } = await supabaseAdmin.functions.invoke("send-invite-email", {
      body: {
        email: adminEmail,
        role: "admin",
        inviteId: invite.id,
        appUrl: origin,
      },
    });

    if (emailError) {
      console.error("Error sending invite email:", emailError);
      console.warn("Organization and invite created successfully, but email failed to send");
    } else {
      console.log("Invite email sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        organizationId: organization.id,
        inviteId: invite.id,
        message: "Organização criada! Email de convite enviado para o administrador."
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
