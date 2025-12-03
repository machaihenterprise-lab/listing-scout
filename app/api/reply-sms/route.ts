// app/api/reply-sms/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { leadId, to, body: text } = await req.json();

    if (!leadId || !to || !text) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase env vars");
      return NextResponse.json(
        { ok: false, error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Send SMS via Telnyx
    const telnyxKey = process.env.TELNYX_API_KEY;
    const telnyxFrom = process.env.TELNYX_MESSAGING_PHONE;

    if (!telnyxKey || !telnyxFrom) {
      console.error("Missing Telnyx env vars");
      return NextResponse.json(
        { ok: false, error: "Missing Telnyx configuration" },
        { status: 500 }
      );
    }

    const sendRes = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${telnyxKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: telnyxFrom,
        to,
        text,
      }),
    });

    const sendBody = await sendRes.json();

    if (!sendRes.ok) {
      console.error("Telnyx send error", sendBody);
      return NextResponse.json(
        { ok: false, error: "Failed to send SMS" },
        { status: 500 }
      );
    }

    // 1️⃣ Insert outbound message into Supabase
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body: text,
        is_auto: false,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] DB insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "Message inserted failed" },
        { status: 500 }
      );
    }

    // 2️⃣ Update lead's last_contacted_at
    await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      message: insertedMessage,
    });
  } catch (err) {
    console.error("reply-sms unhandled error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
