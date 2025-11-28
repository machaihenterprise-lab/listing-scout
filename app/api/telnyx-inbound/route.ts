import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Telnyx sends events under payload.data
    const event = payload?.data;
    if (!event) {
      return NextResponse.json(
        { error: "Invalid Telnyx payload" },
        { status: 400 }
      );
    }

    // Only handle inbound SMS
    if (event.event_type !== "message.received") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const messageData = event.payload;
    const fromNumber = messageData?.from?.phone_number;
    const text = messageData?.text;

    if (!fromNumber || !text) {
      return NextResponse.json(
        { error: "Missing number or text" },
        { status: 400 }
      );
    }

    // Find lead by phone number
    const { data: leadRows, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .ilike("phone", `%${fromNumber}%`)
      .limit(1);

    if (leadError) {
      console.error("Lead lookup error:", leadError);
      return NextResponse.json(
        { error: "Lead lookup failed" },
        { status: 500 }
      );
    }

    if (!leadRows || leadRows.length === 0) {
      console.warn("Inbound message from unknown number:", fromNumber);

      // We still store these in the messages table — useful for debugging
      await supabase.from("messages").insert({
        lead_id: null,
        direction: "INBOUND",
        channel: "SMS",
        body: text,
      });

      return NextResponse.json(
        { warning: "Message stored without matching lead" },
        { status: 200 }
      );
    }

    const lead = leadRows[0];

    // Store the inbound SMS
    const { error: insertError } = await supabase.from("messages").insert({
      lead_id: lead.id,
      direction: "INBOUND",
      channel: "SMS",
      body: text,
      is_auto: false,
    });

    if (insertError) {
      console.error("Error inserting inbound message:", insertError);
      return NextResponse.json(
        { error: "Failed to log inbound message" },
        { status: 500 }
      );
    }

    // OPTIONAL: update last_contacted_at
    await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", lead.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("Inbound webhook error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

// Telnyx also pings GET for health checks:
export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
