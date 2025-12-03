// app/api/reply-sms/route.ts
// app/api/reply-sms/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Telnyx from "telnyx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const telnyxApiKey = process.env.TELNYX_API_KEY;
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID || undefined;
const telnyxFromNumber = process.env.TELNYX_US_NUMBER || "";

// Turn "6137777818" or "+1 613 777 7818" into "+16137777818"
function normalizeToE164(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();

  // already E.164
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, ""); // keep only numbers
  let full = digits;

  if (digits.length === 10) {
    // US/CA local
    full = "1" + digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    full = digits;
  }

  return "+" + full;
}

export async function POST(req: Request) {
  try {
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

    const toPhone = normalizeToE164(to);

    // 1) Send SMS via Telnyx
    let telnyxRes: any;
    try {
      telnyxRes = await telnyx.messages.create({
        from: telnyxFromNumber,
        to: toPhone,
        text,
        // Only include messaging_profile_id if you actually have it set
        ...(telnyxMessagingProfileId
          ? { messaging_profile_id: telnyxMessagingProfileId }
          : {}),
      });

      console.log("[reply-sms] Telnyx response", telnyxRes?.data || telnyxRes);
    } catch (err: any) {
      console.error(
        "[reply-sms] Telnyx send error",
        err?.response?.data || err?.data || err,
      );

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to send via Telnyx",
          details: err?.response?.data || err?.data || String(err),
        },
        { status: 502 },
      );
    }

    // 2) Log outbound message in Supabase
    const providerMessageId =
      telnyxRes?.data?.data?.id ?? telnyxRes?.data?.id ?? null;

    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body: text,
        is_auto: false,
        provider: "telnyx",
        provider_message_id: providerMessageId,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] Supabase insert error", insertError);
      // We *still* return ok:true because the SMS was sent;
      // but we include the error for debugging.
      return NextResponse.json(
        {
          ok: true,
          warning: "SMS sent but failed to log in Supabase",
          insertError,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { ok: true, message: insertedMessage },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("[reply-sms] Unexpected error", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected server error" },
      { status: 500 },
    );
  }
}
