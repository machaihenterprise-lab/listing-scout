import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizeToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 10) {
    // US/CA local 10-digit number
    return "+1" + digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits;
  }
  if (digits.length > 0) {
    return "+" + digits;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("[telnyx-inbound] Missing Supabase env vars");
      return NextResponse.json(
        { ok: false, error: "Supabase env missing" },
        { status: 500 }
      );
    }

    const body = await req.json();
    console.log("[telnyx-inbound] raw body", JSON.stringify(body));

    const eventType =
      body?.data?.event_type || body?.event_type || body?.webhook_type;

    if (eventType !== "message.received" && eventType !== "message.received") {
      console.log("[telnyx-inbound] ignoring non-message event", eventType);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const record = body?.data?.record || body?.data?.payload || body?.data || {};

    const text: string = record?.text || record?.body || "";
    const fromRaw: string | null = record?.from?.phone_number || null;
    const toRaw: string | null =
      record?.to?.[0]?.phone_number || record?.to?.phone_number || null;

    const fromNumber = normalizeToE164(fromRaw);
    const toNumber = normalizeToE164(to
