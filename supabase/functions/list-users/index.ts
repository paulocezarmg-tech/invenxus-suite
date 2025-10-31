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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticated client with the caller's JWT (to check app roles)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: getUserError } = await userClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const userId = userRes.user.id;

    // Check if caller has admin or superadmin role
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isSuperadmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });

    if (!isAdmin && !isSuperadmin) {
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
