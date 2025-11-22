import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";
import { analyzeIntent, type IntentResult } from "../../../lib/analyzeIntent";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;
const AGENT_ALERT_NUMBER = process.env.AGENT_ALERT_NUMBER; // <-- set this in your .env

// Simple TwiML 200 OK back to Twilio
function xmlOk() {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function sendTwilioSms(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error("Twilio env vars missing");
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const params = new URLSearchParams({
    From: TWILIO_PHONE_NUMBER,
    To: to,
    Body: body,
  });

  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
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
    console.error("Twilio send error", res.status, text);
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);

    const from = params.get("From") || "";
    const body = params.get("Body") || "";

    if (!from || !body) {
      console.error("Twilio inbound missing From or Body", { from, body });
      return xmlOk();
    }

    const fromNormalized = normalizePhone(from);
    const createdAt = new Date().toISOString();

    // Lookup lead by phone
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", fromNormalized)
      .limit(1);

    if (leadError) {
      console.error("Error looking up lead for inbound SMS:", leadError);
    }

    const lead = leads?.[0] ?? null;

    // Log inbound message
   const { error: msgError } = await supabase.from("messages").insert({
   lead_id: lead?.id ?? null,
   body,
   direction: "INBOUND",
   is_auto: false,
   channel: "SMS",      
   created_at: createdAt,
 });

    if (msgError) {
      console.error("Error inserting inbound message:", msgError);
    }

    // Run intent analysis
    const intent: IntentResult = analyzeIntent(body);
    console.log("Inbound intent", { from, intent });

    // ---- STOP / UNSUBSCRIBE ----
    if (intent === "STOP") {
      if (lead) {
        const lockUntil = new Date("2099-01-01T00:00:00.000Z").toISOString();
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            status: "UNSUBSCRIBED",
            nurture_status: "PAUSED",
            nurture_locked_until: lockUntil,
          })
          .eq("id", lead.id);

        if (updateError) {
          console.error("Error updating lead to UNSUBSCRIBED:", updateError);
        }
      }

      return xmlOk();
    }

    // ---- NURTURE ONLY / UNKNOWN ----
    if (intent === "NURTURE_ONLY" || intent === "UNKNOWN") {
      // We keep them in the nurture cycle, no status change.
      return xmlOk();
    }

    // ---- HOT INTENTS ----
    // TEMP FORCE HOT FOR TESTING
   const isHot = true;
   console.log("TEMP_FORCE_HOT", { body, intent });

    if (isHot && lead) {
      // Pause nurture for this lead (lock for 7 days)
      const lockUntil = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
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
        console.error("Error updating lead to HOT:", updateError);
      }

      // Send agent alert SMS
      if (AGENT_ALERT_NUMBER) {
        const name = (lead as any).name || "New Lead";
        const address =
          (lead as any).property_address ||
          (lead as any).address ||
          "Unknown";
        const snippet =
          body.length > 120 ? body.slice(0, 117).trimEnd() + "..." : body;

        const alertBody =
          `🔥 HOT LEAD: ${name} ` +
          `🏠 Prop: ${address} ` +
          `💬 Said: "${snippet}"\n` +
          `👇 Tap to Call: ${from}`;

        await sendTwilioSms(AGENT_ALERT_NUMBER, alertBody);
      } else {
        console.warn(
          "AGENT_ALERT_NUMBER not set; skipping agent HOT alert SMS.",
        );
      }
    }

    return xmlOk();
  } catch (err) {
    console.error("Error handling Twilio inbound webhook:", err);
    // Still return 200 so Twilio doesn't retry aggressively
    return xmlOk();
  }
}
