// supabase/functions/run-nurture-cycle/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Lead = {
  id: string;
  name: string | null;
  phone: string;
  nurture_status: string | null;
  nurture_stage: string | null;
  next_nurture_at: string | null;
  last_nurture_sent_at: string | null;
  nurture_locked_until: string | null;
};

// ===== Supabase client (service role) =====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  throw new Error("Supabase env vars not set for run-nurture-cycle");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ===== Telnyx config =====
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
const TELNYX_MESSAGING_PROFILE_ID = Deno.env.get("TELNYX_MESSAGING_PROFILE_ID");
const TELNYX_FROM_NUMBER = Deno.env.get("TELNYX_US_NUMBER");

if (!TELNYX_API_KEY || !TELNYX_MESSAGING_PROFILE_ID || !TELNYX_FROM_NUMBER) {
  console.error("Missing Telnyx env vars");
  throw new Error("Telnyx env vars not set for run-nurture-cycle");
}

// VERY simple nurture templates for now
const NURTURE_TEMPLATES: Record<string, string> = {
  DAY_1:
    "Hi {{name}}, it's Machaih. Got your request about selling. Are you still thinking about making a move this year?",
  // you can add DAY_3, DAY_7, etc later
};

function personalize(template: string, lead: Lead): string {
  const name = lead.name || "there";
  return template.replace("{{name}}", name);
}

async function sendTelnyxSms(to: string, body: string, leadId?: string) {
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: TELNYX_FROM_NUMBER,
      to,
      text: body,
      messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Telnyx error", res.status, text);
    // Attempt to persist the delivery error so we can count it later
    try {
      await supabase.from("delivery_errors").insert({
        lead_id: leadId ?? null,
        to_phone: to,
        provider: "telnyx",
        status_code: res.status,
        error_text: text,
        payload: { url: "https://api.telnyx.com/v2/messages", body },
        created_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.error("Failed to log delivery error to Supabase:", dbErr);
    }

    throw new Error(`Telnyx error ${res.status}`);
  }
}

serve(async () => {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      const { data: expiredSnoozes, error: expiredErr } = await supabase
        .from("leads")
        .select("id")
        .eq("nurture_status", "SNOOZED")
        .lte("nurture_locked_until", nowIso)
        .limit(200);

      if (expiredErr) {
        console.error("Error fetching expired snoozes:", expiredErr);
      } else if (expiredSnoozes && expiredSnoozes.length > 0) {
        const ids = (expiredSnoozes as Array<Record<string, unknown>>).map((r) => r.id).filter(Boolean) as string[];
        // Mark them active and schedule immediately (next_nurture_at = now)
        const { error: updErr } = await supabase.from("leads").update({ nurture_status: "ACTIVE", next_nurture_at: nowIso }).in("id", ids);
        if (updErr) console.error("Error updating expired snoozes:", updErr);
      }
    } catch (e) {
      console.error("Error while handling expired snoozes:", e);
    }

    // 2) Find leads that should get an auto-followup (ACTIVE leads whose next_nurture_at <= now)
    const { data: leads, error } = await supabase
      .from("leads")
      .select(
        "id, name, phone, nurture_status, nurture_stage, next_nurture_at, last_nurture_sent_at, nurture_locked_until",
      )
      .eq("nurture_status", "ACTIVE")
      .lte("next_nurture_at", nowIso)
      // either not locked, or lock has expired
      .or(
        `nurture_locked_until.is.null,nurture_locked_until.lte.${nowIso}`,
      )
      .limit(20);

    if (error) {
      console.error("Error fetching leads:", error);
      return new Response(
        JSON.stringify({ ok: false, step: "fetch-leads", error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!leads || leads.length === 0) {
      // nothing to do this run
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const raw of leads as Lead[]) {
      try {
        const stage = raw.nurture_stage || "DAY_1";
        const template = NURTURE_TEMPLATES[stage];

        if (!template) {
          console.log("No template for stage", stage, "lead", raw.id);
          continue;
        }

        const body = personalize(template, raw);

        // 2) Send SMS via Telnyx
        await sendTelnyxSms(raw.phone, body, raw.id);

        const sentAt = new Date().toISOString();
        const nextAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +24h for now

        // 3) Log message in messages table
        const { error: msgError } = await supabase.from("messages").insert({
          lead_id: raw.id,
          body,
          direction: "OUTBOUND",
          is_auto: true,
          created_at: sentAt,
        });

        if (msgError) {
          console.error("Error inserting auto message:", msgError);
        }

        // 4) Update lead's nurture timings and clear any snooze lock so the lead
        // no longer appears as "Snooze expired" after we processed it.
        const { error: leadError } = await supabase
          .from("leads")
          .update({
            last_nurture_sent_at: sentAt,
            next_nurture_at: nextAt,
            nurture_stage: stage, // later we can advance stages
            nurture_locked_until: null,
          })
          .eq("id", raw.id);

        if (leadError) {
          console.error("Error updating lead nurture fields:", leadError);
        } else {
          processed++;
        }
      } catch (innerErr) {
        console.error("Error processing single lead:", raw.id, innerErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("run-nurture-cycle failed:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        step: "top-level",
        error: message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
