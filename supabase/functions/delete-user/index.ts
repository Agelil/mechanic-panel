import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) throw new Error("Unauthorized");

    // Check permission
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: hasPermData } = await adminClient.rpc("has_permission", {
      _user_id: caller.id,
      _permission: "delete_user_accounts",
    });
    if (!hasPermData) throw new Error("Forbidden: missing delete_user_accounts permission");

    const { registry_id, user_id } = await req.json();
    if (!registry_id) throw new Error("registry_id is required");

    // Delete from users_registry
    await adminClient.from("users_registry").delete().eq("id", registry_id);

    // Delete from user_roles if linked
    if (user_id) {
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("profiles").delete().eq("user_id", user_id);
      // Delete auth user
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (deleteErr) console.error("Failed to delete auth user:", deleteErr.message);
    }

    // Audit log
    await adminClient.from("security_audit_log").insert({
      user_id: caller.id,
      user_email: caller.email,
      action: "delete_user_account",
      target_table: "users_registry",
      target_id: registry_id,
      details: { deleted_auth_user_id: user_id || null },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
