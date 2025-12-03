import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// quick helper to normalize phone numbers for matching
function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^\d]/g, ""); // keep only digits
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const telnyxWebhookSecret = process.env.TELNYX_WEBHOOK_SECRET || "";

    if (!supabaseUrl || !serviceKey) {
      console.error("[telnyx-inbound] Missing Supabase env vars");
      return NextResponse.json(
        { ok: false, error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

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
    const msgPayload =
      event?.payload ||
      event?.record ||
      event?.data ||
      event?.message ||
      {};

    const directionRaw =
      msgPayload?.direction ||
      event?.direction ||
      payload?.direction ||
      "INBOUND";

    const text =
      msgPayload?.text ||
      msgPayload?.body ||
      msgPayload?.content ||
      payload?.text;

    const fromNumber =
      msgPayload?.from?.phone_number ||
      msgPayload?.from_number ||
      msgPayload?.from ||
      payload?.from;

    const toNumber =
      msgPayload?.to?.phone_number ||
      msgPayload?.to_number ||
      msgPayload?.to ||
      payload?.to;
    const channel = (msgPayload?.channel || "sms").toString().toLowerCase();
    const direction =
      (directionRaw as string).toUpperCase() === "OUTBOUND" ? "OUTBOUND" : "INBOUND";

    console.log("[telnyx-inbound] Raw payload:", JSON.stringify(payload));
    console.log("[telnyx-inbound] Parsed:", {
      direction,
      text,
      fromNumber,
      toNumber,
    });

    if (!text || !fromNumber) {
      return NextResponse.json(
        { ok: false, error: "Missing text or fromNumber" },
        { status: 400 }
      );
    }

    const fromNorm = normalizePhone(fromNumber);
    if (!fromNorm) {
      return NextResponse.json(
        { ok: false, error: "Invalid from phone" },
        { status: 400 }
      );
    }

    // Try to match a lead by phone. We match on the *last 10 digits*
    // so that +1 / country code differences don’t break it.
    const last10 = fromNorm.slice(-10);

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, phone")
      .ilike("phone", `%${last10}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadError) {
      console.error("[telnyx-inbound] Lead lookup error:", leadError);
    }

    // Start with the matched lead (if any) then allow creation fallback
    let leadId = lead?.id ?? null;

    // If no lead matched, optionally create a new lead so the message appears in the UI
    if (!leadId) {
      try {
        const { data: newLead, error: createLeadError } = await supabase
          .from("leads")
          .insert({
            phone: fromNorm,
            name: fromNorm,
            source: "telnyx",
            status: "NURTURE",
            nurture_status: "ACTIVE",
          })
          .select("id")
          .maybeSingle();
        if (createLeadError) {
          console.error("[telnyx-inbound] Lead create error:", createLeadError);
        } else if (newLead?.id) {
          leadId = newLead.id;
        }
      } catch (createErr) {
        console.error("[telnyx-inbound] Lead create unexpected error:", createErr);
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        body: text,
        direction,
        channel,
        is_auto: false,
      })
      .select("*")
      .maybeSingle();

    if (insertError) {
      console.error("[telnyx-inbound] Insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to log message" },
        { status: 500 }
      );
    }

    // Use the inserted message returned from Supabase (may be null)
    const insertedMessage = inserted ?? null;

    // If we found a lead, update its "last activity" fields
    if (leadId) {
      const now = new Date().toISOString();
      const preview = text.slice(0, 140);

      const { error: updateError } = await supabase
        .from("leads")
        .update({
          last_activity_at: now,
          last_message_at: now,
          last_message_preview: preview,
          has_unread_messages: true,
        })
        .eq("id", leadId);

      if (updateError) {
        console.error("[telnyx-inbound] Lead update error:", updateError);
      }
    } else {
      console.log(
        "[telnyx-inbound] No matching lead found for inbound SMS from",
        fromNumber
      );
    }

    // You could also auto-pause automation here if you want:
    // if (leadId) { ... set nurture_status / automationPaused ... }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telnyx-inbound] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
