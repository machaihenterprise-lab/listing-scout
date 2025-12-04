import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeInboundIntent, InboundIntent } from "@/app/lib/inboundIntent";
import { routeInboundMessage } from "@/app/lib/routeInboundMessage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Optional: if/when you add a signing secret in Telnyx
const telnyxWebhookSecret = process.env.TELNYX_WEBHOOK_SECRET || "";

if (!supabaseUrl || !serviceKey) {
  console.error("[telnyx-inbound] Missing Supabase env vars");
}

const supabase = createClient(supabaseUrl!, serviceKey!, {
  auth: { persistSession: false },
});

// quick helper to normalize phone numbers for matching
function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^\d]/g, ""); // keep only digits
}

export async function POST(req: Request) {
  try {
    // Telnyx usually sends JSON; we read it as text first in case
    const raw = await req.text();

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      console.error("[telnyx-inbound] Failed to parse JSON", err);
      return NextResponse.json(
        { ok: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Optional: signature verification (left as TODO so we don’t block you)
    if (telnyxWebhookSecret) {
      // TODO: verify Telnyx signature using telnyxWebhookSecret
      // For now we just log that we *could* verify
      console.log("[telnyx-inbound] TELNYX_WEBHOOK_SECRET set; skipping verify for now.");
    }

    // Telnyx event shapes can vary a bit; we try a few common layouts
    const event = payload?.data || payload?.event || payload;
    const eventData =
      event?.payload ||
      event?.record ||
      event?.data ||
      event?.message ||
      {};

    // 1) Find the lead by phone
    const fromNumber = normalizePhone(
      eventData?.from?.phone_number ??
        eventData?.from_number ??
        eventData?.from ??
        null
    );
    const toNumber = normalizePhone(
      eventData?.to?.[0]?.phone_number ??
        eventData?.to?.phone_number ??
        eventData?.to_number ??
        eventData?.to ??
        null
    );
    const text: string = eventData?.text ?? eventData?.body ?? eventData?.content ?? "";

    if (!text || !fromNumber) {
      return NextResponse.json(
        { ok: false, error: "Missing text or fromNumber" },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", fromNumber)
      .maybeSingle();

    if (leadError) {
      console.error("[telnyx-inbound] error loading lead:", leadError);
    }

    // 2) Insert the inbound message
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: lead?.id ?? null,
        direction: "INBOUND",
        channel: "SMS",
        body: text,
        is_auto: false,
        from_number: fromNumber,
        to_number: toNumber,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[telnyx-inbound] failed to log inbound message:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to log message" },
        { status: 500 }
      );
    }

    // 3) Analyze intent + auto-route
    const intent: InboundIntent = analyzeInboundIntent(text);

    await routeInboundMessage({
      supabase,
      lead: lead ?? null,
      message: insertedMessage,
      intent,
    });

    // 4) Respond OK to Telnyx
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telnyx-inbound] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
