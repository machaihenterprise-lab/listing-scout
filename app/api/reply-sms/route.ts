import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Telnyx from "telnyx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxApiKey = process.env.TELNYX_API_KEY!;
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID!;
const telnyxUsNumber = process.env.TELNYX_US_NUMBER!;
const telnyxCaNumber = process.env.TELNYX_CA_NUMBER ?? null;

// Supabase (service) client
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// Telnyx client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const telnyx = new (Telnyx as any)(telnyxApiKey);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      leadId,
      to,
      body: text,
      country,
    }: { leadId?: string; to?: string; body?: string; country?: string } = body;

    if (!leadId || !to || !text) {
      console.error("[reply-sms] Missing required fields:", body);
      return NextResponse.json(
        { ok: false, error: "leadId, to and body are required" },
        { status: 400 },
      );
    }

    if (!supabaseUrl || !serviceKey || !telnyxApiKey || !telnyxMessagingProfileId) {
      console.error("[reply-sms] Missing env vars", {
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
        hasTelnyxApiKey: !!telnyxApiKey,
        hasProfileId: !!telnyxMessagingProfileId,
      });
      return NextResponse.json(
        { ok: false, error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Pick correct from-number (US default, CA if explicitly requested)
    const fromNumber =
      country === "CA" && telnyxCaNumber ? telnyxCaNumber : telnyxUsNumber;

    // 1) Send via Telnyx
    let telnyxMessage: any;
    try {
      telnyxMessage = await telnyx.messages.create({
        from: fromNumber,
        to,
        text,
        messaging_profile_id: telnyxMessagingProfileId,
      });
      console.log(
        "[reply-sms] Telnyx message sent",
        telnyxMessage?.data?.id ?? telnyxMessage,
      );
    } catch (err: any) {
      console.error(
        "[reply-sms] Telnyx send error",
        err?.response?.body ?? err,
      );
      return NextResponse.json(
        { ok: false, error: "Failed to send via Telnyx" },
        { status: 502 },
      );
    }

    const telnyxMessageId = telnyxMessage?.data?.id ?? null;

    // 2) Log in messages table
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body: text,
        is_auto: false,
        telnyx_message_id: telnyxMessageId,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] Supabase insert error", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to log message" },
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
