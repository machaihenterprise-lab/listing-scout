import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import telnyxPackage from "telnyx";

// --- Env vars ---
// (these must exist in your .env.local and on Vercel)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const telnyxApiKey = process.env.TELNYX_API_KEY!;
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID!;
// Ensure your Telnyx sending number is in E.164 format, e.g., +13479198781
const telnyxFromNumber = process.env.TELNYX_US_NUMBER!;

// Supabase (service role) – server-side only
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// Telnyx client – SDK style
const telnyx = telnyxPackage(telnyxApiKey);

// Define the expected shape of the request body
interface ReplySmsBody {
  leadId: string;
  agentId: string; // NEW: The user who is sending the message
  to: string; // The lead's number
  body: string; // The message text
}

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
    const body: Partial<ReplySmsBody> = await req.json().catch(() => ({}));
    const { leadId, agentId, to, body: text } = body as Partial<ReplySmsBody>;

    // 1. Basic Input Validation
    if (!leadId || !agentId || !to || !text) {
      console.error("[reply-sms] Missing required fields: leadId, agentId, to, or body.");
      return NextResponse.json(
        { ok: false, error: "leadId, agentId, to, and body are required" },
        { status: 400 }
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
    console.log(`[reply-sms] Attempting to send SMS to ${toE164} from agent ${agentId} on lead ${leadId}`);

    // 2. Send SMS via Telnyx
    const telnyxRes = await telnyx.messages.create({
      from: telnyxFromNumber,
      to: toE164,
      text,
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

    const providerMessageId =
      (telnyxRes as any)?.data?.id ?? (telnyxRes as any)?.id ?? null;

    // 3. Log outbound message in Supabase
    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        lead_id: leadId,
        agent_id: agentId,          // NEW: Agent who sent it
        direction: "OUTBOUND",
        sender_type: "agent",        // NEW: Sender is always the agent here
        channel: "SMS",
        body: text,
        is_auto: false,
        from_number: telnyxFromNumber,
        to_number: toE164,
        provider_message_id: providerMessageId,
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
      telnyxId: providerMessageId,
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