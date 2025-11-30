import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for server-side inserts (stronger guarantees)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { leadId, to, body } = await req.json();

    if (!leadId || !to || !body) {
      return NextResponse.json(
        { error: "Missing leadId, to, or body" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TELNYX_API_KEY;
    const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
    const fromNumber = process.env.TELNYX_US_NUMBER; // TODO: later choose US/CA based on lead

    if (!apiKey || !profileId || !fromNumber) {
      return NextResponse.json(
        { error: "Telnyx environment variables are not set" },
        { status: 500 }
      );
    }

    // 1) Send SMS via Telnyx API
    const telnyxRes = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromNumber,
        to,
        text: body,
        messaging_profile_id: profileId,
      }),
    });

    const telnyxJson = await telnyxRes.json().catch(() => ({}));

    if (!telnyxRes.ok) {
      console.error("Telnyx error:", telnyxRes.status, telnyxJson);
      // Attempt to persist the delivery error for later inspection/metrics
      try {
        await supabase.from("delivery_errors").insert({
          lead_id: leadId,
          to_phone: to,
          provider: "telnyx",
          status_code: telnyxRes.status,
          error_text:
            telnyxJson?.errors?.[0]?.detail || JSON.stringify(telnyxJson),
          payload: telnyxJson ?? {},
        });
      } catch (dbErr) {
        console.error("Failed to log delivery error to Supabase:", dbErr);
      }

      return NextResponse.json(
        {
          error:
            telnyxJson?.errors?.[0]?.detail ||
            `Failed to send SMS via Telnyx (status ${telnyxRes.status})`,
        },
        { status: 500 }
      );
    }

    // 2) Log outbound message in Supabase (service role)
    try {
      const { error: insertError } = await supabase.from("messages").insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body,
        is_auto: false,
      });

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return NextResponse.json(
          {
            warning: "SMS sent but logging to Supabase failed",
            supabaseError: insertError.message,
          },
          { status: 200 }
        );
      }
    } catch (dbErr) {
      console.error("Unexpected DB error logging message:", dbErr);
    }

    return NextResponse.json(
      {
        success: true,
        telnyxMessageId: telnyxJson?.data?.id ?? null,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    console.error("Unexpected /api/reply-sms error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
