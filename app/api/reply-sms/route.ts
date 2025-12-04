// app/api/reply-sms/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Telnyx env vars
const telnyxApiKey = process.env.TELNYX_API_KEY!;
const telnyxFromNumber = process.env.TELNYX_US_NUMBER!; // E.164, e.g. "+13479198781"
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { leadId, to, body: text } = body as {
      leadId?: string;
      to?: string;
      body?: string;
    };

    if (!leadId || !to || !text) {
      console.error("[reply-sms] Missing fields", body);
      return NextResponse.json(
        { ok: false, error: "leadId, to, and body are required" },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return NextResponse.json(
        { ok: false, error: "Empty message body" },
        { status: 400 }
      );
    }

    // Normalize phone to E.164 (US default if no +)
    const toNumber =
      to.startsWith("+") ? to : `+1${to.replace(/[^\d]/g, "")}`;

    // 1️⃣ Send SMS via Telnyx (same pattern as working curl)
    const telnyxRes = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: telnyxFromNumber, // must be your Telnyx number in E.164
        to: toNumber,
        text: trimmedText,
        messaging_profile_id: telnyxMessagingProfileId,
      }),
    });

    const telnyxBody = await telnyxRes.json().catch(() => null);
    console.log(
      "[reply-sms] Telnyx status:",
      telnyxRes.status,
      JSON.stringify(telnyxBody)
    );

    if (!telnyxRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Telnyx send failed",
          telnyx: telnyxBody,
        },
        { status: 502 }
      );
    }

    // 2️⃣ Insert outbound message into Supabase
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body: trimmedText,
        is_auto: false,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] Supabase insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to log message" },
        { status: 500 }
      );
    }

    // 3️⃣ Update lead's last_contacted_at (non-critical if this fails)
    await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", leadId);

    return NextResponse.json(
      {
        ok: true,
        message: insertedMessage,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[reply-sms] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send SMS" },
      { status: 500 }
    );
  }
}
