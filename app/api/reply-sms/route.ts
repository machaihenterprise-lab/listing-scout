// app/api/reply-sms/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const telnyxApiKey = process.env.TELNYX_API_KEY!;
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID!;
const telnyxFromNumber = process.env.TELNYX_US_NUMBER!; // e.g. "+13479198781"

const TELNYX_MESSAGES_URL = "https://api.telnyx.com/v2/messages";

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// US/Canada normalization (we can later expand using `country`)
function normalizeToE164(raw: string, country?: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();

  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, "");

  // Default: assume US/CA if no country is given
  if (!country || country === "US" || country === "CA") {
    if (digits.length === 10) return "+1" + digits;
    if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  }

  // Fallback: just prefix +
  return "+" + digits;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));

    // 👇 match exactly what your frontend sends
    const {
      leadId,
      to,
      body, // this is the message text
      country,
    }: {
      leadId?: string;
      to?: string;
      body?: string;
      country?: string;
    } = payload;

    if (!leadId || !to || !body) {
      return NextResponse.json(
        { ok: false, error: "leadId, to, and body are required" },
        { status: 400 }
      );
    }

    if (!telnyxApiKey || !telnyxMessagingProfileId || !telnyxFromNumber) {
      console.error("[reply-sms] Missing Telnyx env vars", {
        hasApiKey: !!telnyxApiKey,
        hasProfile: !!telnyxMessagingProfileId,
        hasFrom: !!telnyxFromNumber,
      });

      return NextResponse.json(
        { ok: false, error: "Telnyx configuration missing" },
        { status: 500 }
      );
    }

    const toNumber = normalizeToE164(to, country);

    // 1) Send SMS via Telnyx HTTP API
    const telnyxRes = await fetch(TELNYX_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${telnyxApiKey}`,
      },
      body: JSON.stringify({
        from: telnyxFromNumber,
        to: toNumber,
        text: body, // 👈 THIS is what Telnyx expects
        messaging_profile_id: telnyxMessagingProfileId,
      }),
    });

    const telnyxBodyText = await telnyxRes.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let telnyxBody: any;
    try {
      telnyxBody = JSON.parse(telnyxBodyText);
    } catch {
      telnyxBody = telnyxBodyText;
    }

    console.log("[reply-sms] Telnyx status:", telnyxRes.status);
    console.log("[reply-sms] Telnyx body:", telnyxBody);

    if (!telnyxRes.ok) {
      // Surface *exactly* what Telnyx complained about
      return NextResponse.json(
        {
          ok: false,
          error: "Telnyx API error",
          status: telnyxRes.status,
          telnyxBody,
        },
        { status: 502 }
      );
    }

    // 2) Log outbound message in Supabase so it shows in the conversation
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body, // same text as sent
        is_auto: false,
        from_number: telnyxFromNumber,
        to_number: toNumber,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] Supabase insert error:", insertError);
      // still return ok since SMS was sent, but include warning
      return NextResponse.json(
        {
          ok: true,
          warning: "SMS sent but failed to log in Supabase",
          insertError,
          telnyx: telnyxBody,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: insertedMessage,
        telnyx: telnyxBody,
      },
      { status: 200 }
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[reply-sms] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
