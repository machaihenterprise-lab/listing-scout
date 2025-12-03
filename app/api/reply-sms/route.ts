// app/api/telnyx-inbound/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^\d]/g, "");
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => null);
    console.log("[telnyx-inbound] payload:", payload);

    // Telnyx message webhooks usually have data.record_type === "message"
    const msg = payload?.data;
    if (!msg || msg.record_type !== "message") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const fromRaw = msg.from?.phone_number as string | undefined;
    const toRaw =
      (Array.isArray(msg.to) && msg.to[0]?.phone_number) ||
      (msg.to?.phone_number as string | undefined);
    const body = msg.text as string;

    const fromNorm = normalizePhone(fromRaw);
    if (!fromNorm) {
      console.error("[telnyx-inbound] Missing from number");
      return NextResponse.json(
        { ok: false, error: "Missing from phone" },
        { status: 400 }
      );
    }

    // Find matching lead by phone (basic version: match on last digits)
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, phone");

    if (leadError) {
      console.error("[telnyx-inbound] leadError:", leadError);
    }

    let leadId: string | null = null;
    if (leads && leads.length > 0) {
      const match = leads.find((l: any) => {
        const lp = normalizePhone(l.phone);
        return lp && lp.endsWith(fromNorm);
      });
      if (match) {
        leadId = match.id;
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "INBOUND",
        channel: "SMS",
        body,
        is_auto: false,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[telnyx-inbound] insertError:", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to store message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: inserted });
  } catch (err: any) {
    console.error("[telnyx-inbound] Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
