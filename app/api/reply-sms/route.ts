// app/api/reply-sms/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Telnyx from "telnyx";

// Normalize phone numbers to E.164. If no country code, default to +1.
function normalizeToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 10) {
    return "+1" + digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits;
  }
  return digits ? "+" + digits : null;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const telnyxApiKey = process.env.TELNYX_API_KEY;
    const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID || undefined;
    const telnyxFromNumber = process.env.TELNYX_US_NUMBER || "";
    const telnyxCaNumber = process.env.TELNYX_CA_NUMBER || "";

    const body = await req.json().catch(() => ({}));
    const {
      leadId,
      to,
      text,
      body: bodyField,
      country,
    }: { leadId?: string; to?: string; text?: string; body?: string; country?: string } = body;

    const content = text ?? bodyField;

    if (!leadId || !to || !content) {
      return NextResponse.json(
        { ok: false, error: "leadId, to, and text/body are required" },
        { status: 400 },
      );
    }

    if (!supabaseUrl || !serviceKey) {
      console.error("[reply-sms] Missing Supabase env vars");
      return NextResponse.json(
        { ok: false, error: "Supabase configuration missing on server" },
        { status: 500 },
      );
    }
    if (!telnyxApiKey || !telnyxFromNumber) {
      console.error("[reply-sms] Missing Telnyx env vars", {
        hasKey: !!telnyxApiKey,
        hasFrom: !!telnyxFromNumber,
        hasProfile: !!telnyxMessagingProfileId,
      });
      return NextResponse.json(
        { ok: false, error: "Telnyx configuration missing on server" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const telnyx = new (Telnyx as any)(telnyxApiKey);

    const fromRaw = country === "CA" && telnyxCaNumber ? telnyxCaNumber : telnyxFromNumber;
    const fromNumber = normalizeToE164(fromRaw);
    const toNumber = normalizeToE164(to);

    if (!fromNumber || !toNumber) {
      return NextResponse.json(
        { ok: false, error: "Invalid phone number format" },
        { status: 400 },
      );
    }

    // 1) Send SMS via Telnyx
    let telnyxRes: any;
    try {
      telnyxRes = await telnyx.messages.create({
        from: fromNumber,
        to: toNumber,
        text: content,
        ...(telnyxMessagingProfileId
          ? { messaging_profile_id: telnyxMessagingProfileId }
          : {}),
      });
      console.log("[reply-sms] Telnyx response", telnyxRes?.data || telnyxRes);
    } catch (err: any) {
      console.error("[reply-sms] Telnyx send error", err?.response?.data || err?.data || err);
      return NextResponse.json(
        { ok: false, error: "Failed to send via Telnyx", details: err?.response?.data || err?.data || String(err) },
        { status: 502 },
      );
    }

    // 2) Log outbound message in Supabase (keep columns minimal to match your table)
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "sms",
        body: content,
        is_auto: false,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] Supabase insert error", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to log message", details: insertError.message || insertError },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, message: insertedMessage });
  } catch (err) {
    console.error("[reply-sms] Unexpected error", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error" },
      { status: 500 },
    );
  }
}
