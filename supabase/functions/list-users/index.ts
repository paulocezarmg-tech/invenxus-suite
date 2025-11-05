// List users securely using service role; only admins/superadmins can access
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing required envs", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!anonKey,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticated client with the caller's JWT (to check app roles)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: getUserError } = await userClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      console.error("Failed to get user:", getUserError);
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const userId = userRes.user.id;
    console.log("Checking permissions for user:", userId);

    // Check if caller has admin or superadmin role
    const { data: isAdmin, error: adminError } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    console.log("isAdmin check:", { isAdmin, adminError });

    const { data: isSuperadmin, error: superadminError } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    console.log("isSuperadmin check:", { isSuperadmin, superadminError });

    if (!isAdmin && !isSuperadmin) {
      console.error("User lacks admin/superadmin role:", { userId, isAdmin, isSuperadmin });
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const perPage = parseInt(url.searchParams.get("perPage") ?? "100", 10);

    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      phone: (u as any).phone ?? null,
    }));

    return new Response(
      JSON.stringify({ users, page, perPage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
