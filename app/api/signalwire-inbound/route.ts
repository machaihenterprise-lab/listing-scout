// app/api/signalwire-inbound/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { analyzeIntent } from "@/lib/analyzeIntent";

// ENV
const AGENT_ALERT_NUMBER = process.env.AGENT_ALERT_NUMBER || "";
const SIGNALWIRE_SPACE_URL = process.env.SIGNALWIRE_SPACE_URL || ""; // e.g. "example.signalwire.com"
const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID || "";
const SIGNALWIRE_API_TOKEN = process.env.SIGNALWIRE_API_TOKEN || "";

// --- helpers ---

function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");

  // North America: if 10 digits, assume +1
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return `+${digits}`;
}

function xmlOk(): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

async function sendAgentAlertSms(to: string, body: string) {
  if (!SIGNALWIRE_SPACE_URL || !SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN) {
    console.error("SignalWire env vars missing, cannot send agent SMS");
    return;
  }

  const url = `https://${SIGNALWIRE_SPACE_URL}/api/laml/2010-04-01/Accounts/${SIGNALWIRE_PROJECT_ID}/Messages.json`;

  const params = new URLSearchParams({
    From: to, // ⚠️ we’ll set actual From per-number later if needed
    To: to,
    Body: body,
  });

  const auth = Buffer.from(
    `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
  ).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error sending SignalWire SMS", res.status, text);
  }
}

export async function POST(req: Request) {
  try {
    // SignalWire Compatibility webhooks send form-encoded data (Twilio-style)
    const form = await req.formData();
    const from = (form.get("From") || "").toString();
    const body = (form.get("Body") || "").toString();

    if (!from || !body) {
      console.error("SignalWire inbound missing From or Body", { from, body });
      return xmlOk();
    }

    const fromNormalized = normalizePhone(from);
    const createdAt = new Date().toISOString();

    // 1) Lookup lead by phone
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", fromNormalized)
      .limit(1);

    if (leadError) {
      console.error("Error looking up lead for inbound SMS", leadError);
    }

    const lead = leads?.[0] ?? null;

    // 2) Log inbound message (even if we don't find a lead)
    const { error: msgError } = await supabase.from("messages").insert({
      lead_id: lead?.id ?? null,
      body,
      direction: "INBOUND",
      channel: "SMS",
      created_at: createdAt,
      is_auto: false,
    });

    if (msgError) {
      console.error("Error logging inbound SignalWire message", msgError);
    }

    // 3) Classify intent
    const intent = await analyzeIntent(body);
    console.log("SIGNALWIRE_INBOUND_INTENT", { from: fromNormalized, intent });

    // --- NURTURE ONLY / UNKNOWN ---
    if (intent === "NURTURE_ONLY" || intent === "UNKNOWN") {
      // No status change; they stay in nurture
      return xmlOk();
    }

    // --- HOT INTENTS ---
    const isHot =
      intent === "HOT_APPOINTMENT" ||
      intent === "HOT_VALUATION" ||
      intent === "HOT_CALL_REQUEST" ||
      intent === "HOT_GENERAL";

    if (isHot && lead) {
      const lockUntil = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
      ).toISOString();

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          status: "HOT",
          nurture_status: "PAUSED",
          nurture_locked_until: lockUntil,
        })
        .eq("id", lead.id);

      if (updateError) {
        console.error("Error updating lead to HOT (SignalWire)", updateError);
      } else {
        console.log("Lead marked HOT (SignalWire)", {
          leadId: lead.id,
          phone: lead.phone,
          intent,
        });
      }

      // Agent alert SMS (optional for now; we can refine From later)
      if (AGENT_ALERT_NUMBER) {
        const alertBody = `HOT LEAD: ${
          lead.name || lead.phone
        } replied:\n"${body}"`;
        await sendAgentAlertSms(AGENT_ALERT_NUMBER, alertBody);
      } else {
        console.warn("AGENT_ALERT_NUMBER not set; skipping hot alert SMS");
      }
    }

    return xmlOk();
  } catch (err) {
    console.error("Error in SignalWire inbound handler", err);
    return xmlOk();
  }
}
