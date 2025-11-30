import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  throw new Error("Supabase env vars not set for expire-snoozes");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

serve(async (req) => {
  try {
    const now = new Date().toISOString();

    // find leads that are snoozed but whose lock has expired
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, nurture_status, nurture_locked_until, created_at")
      .eq("nurture_status", "SNOOZED")
      .lte("nurture_locked_until", now)
      .order("nurture_locked_until", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error fetching expired snoozes:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    const results = (data || []) as Array<Record<string, unknown>>;

    // Optional query parameter `apply=true` will update matched rows' `next_nurture_at`
    // to now, so they can be picked up by the nurture cycle if desired.
    const url = new URL(req.url);
    // apply=true will update matched rows; dry_run or dry_run=true are aliases
    // for running a dry listing without mutating data.
    let apply = url.searchParams.get("apply") === "true";
    const dryRun = url.searchParams.get("dry_run") === "true" || url.searchParams.get("dry") === "true";
    if (dryRun) apply = false;

    let applied = false;
    let updatedIds: string[] = [];

    if (apply && results.length > 0) {
      const nowIso = new Date().toISOString();
      const ids = results.map((r) => r.id).filter(Boolean) as string[];
      const { error: updateErr } = await supabase
        .from("leads")
        .update({ next_nurture_at: nowIso })
        .in("id", ids);

      if (updateErr) {
        console.error("Error updating expired snoozes:", updateErr);
        return new Response(JSON.stringify({ ok: false, error: updateErr.message }), { status: 500 });
      }

      applied = true;
      updatedIds = ids;
    }

    return new Response(
      JSON.stringify({ ok: true, server_now: now, applied, count: results.length, updated_ids: updatedIds, leads: results }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("expire-snoozes failed:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
