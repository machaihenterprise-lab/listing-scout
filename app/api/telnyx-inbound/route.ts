import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeInboundIntent } from "@/app/lib/inboundIntent";
import { routeInboundMessage } from "@/app/lib/routeInboundMessage";

// quick helper to normalize phone numbers for matching
function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[^\d]/g, ""); // keep digits only
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const telnyxWebhookSecret = process.env.TELNYX_WEBHOOK_SECRET || "";
    void telnyxWebhookSecret; // reserved for future signature verification

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();

    // adjust these paths if yours are slightly different
    const payload = body?.data?.payload;
    const text: string = payload?.text || "";
    const fromNumberRaw: string = payload?.from?.phone_number || "";
    const toNumberRaw: string = payload?.to?.[0]?.phone_number || "";

    if (!text || !fromNumberRaw) {
      console.error("[telnyx-inbound] missing text or from number");
      return NextResponse.json(
        { ok: false, error: "Missing text or from number" },
        { status: 400 }
      );
    }

    // ---- find the lead by phone ----
    const normalized = normalizePhone(fromNumberRaw); // e.g. 14322095555
    let local10 = normalized;
    if (normalized && normalized.length === 11 && normalized.startsWith("1")) {
      local10 = normalized.slice(1); // 10-digit local version
    }

    // we’ll try multiple variants: raw, +E164, digits, 10-digit
    const plusE164 = normalized ? `+${normalized}` : null;

    const orFilters = [
      fromNumberRaw,
      normalized,
      local10,
      plusE164,
    ]
      .filter(Boolean)
      .map((v) => `phone.eq.${v}`)
      .join(",");

    const { data: leadMatch, error: leadErr } = await supabase
      .from("leads")
      .select("id, phone")
      .or(orFilters)
      .limit(1)
      .single();

    if (leadErr && leadErr.code !== "PGRST116") {
      // PGRST116 = no rows; ignore that one
      console.error("[telnyx-inbound] lead lookup error", leadErr);
    }

    const leadId = leadMatch?.id ?? null;

    // ---- insert the inbound message, now with lead_id ----
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "INBOUND",
        channel: "SMS",
        body: text,
        is_auto: false,
        from_number: fromNumberRaw,
        to_number: toNumberRaw,
      })
      .select("*")
      .single();

    if (insertError || !insertedMessage) {
      console.error("[telnyx-inbound] Failed to log message", insertError);
      return NextResponse.json(
        { ok: false, error: "Failed to log message" },
        { status: 500 }
      );
    }

    // ---- analyze intent + route automation ----
    const intent = await analyzeInboundIntent({
      text,
      leadId,
      fromPhone: fromNumberRaw,
      toPhone: toNumberRaw,
    });

    await routeInboundMessage({
      supabase,
      lead: leadMatch ?? null,
      message: insertedMessage,
      intent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telnyx-inbound] fatal error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
