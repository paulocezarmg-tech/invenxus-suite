import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyAdminsRequest {
  userName: string;
  userEmail: string;
  userRole: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userName, userEmail, userRole }: NotifyAdminsRequest = await req.json();

    console.log("Notifying admins about new user:", { userName, userEmail, userRole });

    // Initialize Supabase client with service role to query admin users
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin and superadmin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "superadmin"]);

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify");
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get admin user emails from auth.users
    const adminUserIds = adminRoles.map((role) => role.user_id);
    const { data: adminUsers, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching admin users:", usersError);
      throw usersError;
    }

    const adminEmails = adminUsers.users
      .filter((user) => adminUserIds.includes(user.id))
      .map((user) => user.email)
      .filter((email): email is string => email !== undefined);

    console.log(`Sending notifications to ${adminEmails.length} admins`);

    // Send email to each admin using Resend API
    const emailPromises = adminEmails.map((adminEmail) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "StockMaster <onboarding@resend.dev>",
          to: [adminEmail],
          subject: "Novo Usuário Cadastrado - StockMaster",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
                Novo Usuário Cadastrado
              </h1>
              <p style="font-size: 16px; color: #333; margin: 20px 0;">
                Um novo usuário aceitou o convite e completou o cadastro no StockMaster:
              </p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 8px 0;"><strong>Nome:</strong> ${userName}</p>
                <p style="margin: 8px 0;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin: 8px 0;"><strong>Perfil:</strong> ${userRole}</p>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                O usuário já pode fazer login no sistema com as credenciais cadastradas.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Esta é uma notificação automática do StockMaster
              </p>
            </div>
          `,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Email notifications sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: successful,
        failed: failed 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-admins-new-user function:", error);
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
