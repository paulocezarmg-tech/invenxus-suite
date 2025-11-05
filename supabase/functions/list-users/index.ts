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

    // Get all roles for the user
    const { data: rolesData, error: rolesError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    console.log("User roles:", { rolesData, rolesError });

    if (rolesError || !rolesData || rolesData.length === 0) {
      console.error("Failed to get user roles or user has no roles:", { userId, rolesError });
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Define role hierarchy
    const roleHierarchy: Record<string, number> = {
      superadmin: 4,
      admin: 3,
      almoxarife: 2,
      auditor: 1,
      operador: 0
    };

    // Find highest privilege role
    const highestRole = rolesData.reduce((highest, current) => {
      const currentLevel = roleHierarchy[current.role] || 0;
      const highestLevel = roleHierarchy[highest] || 0;
      return currentLevel > highestLevel ? current.role : highest;
    }, rolesData[0].role);

    console.log("User highest role:", highestRole);

    // Check if user has at least admin privileges
    const userRoleLevel = roleHierarchy[highestRole] || 0;
    const adminLevel = roleHierarchy['admin'];

    if (userRoleLevel < adminLevel) {
      console.error("User lacks admin/superadmin privileges:", { userId, highestRole, level: userRoleLevel });
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
