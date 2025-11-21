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

// ===== Twilio config =====
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER")!;

const TWILIO_AUTH_HEADER =
  "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

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

async function sendTwilioSms(to: string, body: string) {
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const params = new URLSearchParams({
    From: TWILIO_FROM_NUMBER,
    To: to,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: TWILIO_AUTH_HEADER,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Twilio error", res.status, text);
    throw new Error(`Twilio error ${res.status}`);
  }
}

serve(async (_req) => {
  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1) Find leads that should get an auto-followup
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

        // 2) Send SMS via Twilio
        await sendTwilioSms(raw.phone, body);

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

        // 4) Update lead's nurture timings
        const { error: leadError } = await supabase
          .from("leads")
          .update({
            last_nurture_sent_at: sentAt,
            next_nurture_at: nextAt,
            nurture_stage: stage, // later we can advance stages
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
    console.error("run-nurture-cycle failed:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        step: "top-level",
        error: (err as Error).message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
