import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Telnyx from "telnyx";

// --- Env vars ---
// (these must exist in your .env.local and on Vercel)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const telnyxApiKey = process.env.TELNYX_API_KEY
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
// Ensure your Telnyx sending number is in E.164 format, e.g., +13479198781
const telnyxFromNumber = process.env.TELNYX_US_NUMBER || process.env.TELNYX_CA_NUMBER

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing required Supabase environment variables.")
}

// Supabase (service role) – server-side only
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

// Telnyx client – SDK style
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const telnyx = new (Telnyx as any)(telnyxApiKey);

// Define the expected shape of the request body
type ReplySmsBody = {
  leadId: string;
  to: string;
  body: string;
  country?: string;
};

/**
 * Normalizes a number string to E.164 format (+CCNNNNNNNNN).
 * Assumes US/CA numbers (10 or 11 digits starting with 1) for the automatic '+1' prefix.
 * For production international apps, use libphonenumber-js.
 */
function normalizeToE164(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();

  // If it already starts with a plus, assume it's correctly formatted E.164
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, ""); // Remove all non-digits

  if (digits.length === 10) {
    // 10 digits (e.g., 6137777818) -> assumed US/CA, prepend +1
    return "+1" + digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // 11 digits starting with 1 (e.g., 16137777818) -> prepend +
    return "+" + digits;
  }
  
  // Return a generic + prefix for any other number (e.g., if it's already a foreign country code)
  return "+" + digits; 
}


export async function POST(req: Request) {
  try {
    const body: Partial<ReplySmsBody & { text?: string }> = await req.json().catch(() => ({}));
    const { leadId, to, body: textBody, text, country } = body;
    const content = text ?? textBody;

    // 1. Basic Input Validation
    if (!leadId || !to || !content) {
      console.error("[reply-sms] Missing required fields: leadId, to, or body.");
      return NextResponse.json(
        { ok: false, error: "leadId, to, and body/text are required" },
        { status: 400 },
      );
    }

    const toE164 = normalizeToE164(to);

    if (!telnyxApiKey || !telnyxMessagingProfileId || !telnyxFromNumber) {
      console.error("[reply-sms] Missing Telnyx env vars configuration.");
      return NextResponse.json(
        { ok: false, error: "Telnyx configuration missing" },
        { status: 500 }
      );
    }

    // Log the action before calling external API
    console.log(`[reply-sms] Attempting to send SMS to ${toE164} on lead ${leadId}`);

    // 2. Send SMS via Telnyx
    const telnyxRes = await telnyx.messages.create({
      from: telnyxFromNumber,
      to: toE164,
      text: content,
      messaging_profile_id: telnyxMessagingProfileId,
    });
    
    // Check for Telnyx API level errors (even if status 200/202)
    if ((telnyxRes as any)?.errors) {
        const telnyxError = (telnyxRes as any).errors[0];
        console.error("[reply-sms] Telnyx API Error:", telnyxError);
        return NextResponse.json(
            { ok: false, error: `Telnyx failed: ${telnyxError.detail || telnyxError.code}` },
            { status: 400 }
        );
    }

    // 3. Log outbound message in Supabase
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        direction: "OUTBOUND",
        channel: "sms",
        body: content,
        is_auto: false,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[reply-sms] Supabase insert error (Message Sent but Log Failed):", insertError);
      // We still return ok=true because the SMS was successfully sent to the lead.
    }

    // 4. Success Response
    return NextResponse.json({
      ok: true,
      message: insertedMessage,
    });
  } catch (err: any) {
    // Catch networking or unhandled errors
    console.error("[reply-sms] Unhandled Error in POST:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to send SMS due to unhandled server error",
      },
      { status: 500 }
    );
  }
}
