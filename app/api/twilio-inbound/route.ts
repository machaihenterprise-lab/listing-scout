// app/api/twilio-inbound/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { analyzeIntent } from "@/lib/analyzeIntent";

// ENV
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;
const AGENT_ALERT_NUMBER = process.env.AGENT_ALERT_NUMBER || "";

// --- helpers ---

function normalizePhone(phone: string): string {
  if (!phone) return "";

  // Strip everything that isn't a digit
  const digits = phone.replace(/\D/g, "");

  // Simple North America logic: if 10 digits, assume +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If already starts with country code (like 11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Fallback: just prefix + and hope it's already correct length
  return `+${digits}`;
}

function xmlOk(): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

async function sendTwilioSms(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error("Twilio env vars missing, cannot send SMS");
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: TWILIO_PHONE_NUMBER,
    To: to,
    Body: body,
  });

  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
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
    console.error("Error sending Twilio SMS", res.status, text);
  }
}

// --- main handler ---

export async function POST(req: Request) {
  // Twilio sends x-www-form-urlencoded
  const params = await req.formData();
  const from = (params.get("From") || "").toString();
  const body = (params.get("Body") || "").toString();

  if (!from || !body) {
    console.error("Twilio inbound missing From or Body", { from, body });
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
    console.error("Error logging inbound message", msgError);
  }

  // 3) Classify intent
  const intent = await analyzeIntent(body);
  console.log("INBOUND_INTENT", { from: fromNormalized, intent });

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
      console.error("Error updating lead to HOT", updateError);
    } else {
      console.log("Lead marked HOT", {
        leadId: lead.id,
        phone: lead.phone,
        intent,
      });
    }

    // Agent alert SMS
    if (AGENT_ALERT_NUMBER) {
      const alertBody = `HOT LEAD: ${
        lead.name || lead.phone
      } replied:\n"${body}"`;
      await sendTwilioSms(AGENT_ALERT_NUMBER, alertBody);
    } else {
      console.warn("AGENT_ALERT_NUMBER not set; skipping hot alert SMS");
    }
  }

  // Nothing else to say back to the lead via TwiML
  return xmlOk();
}