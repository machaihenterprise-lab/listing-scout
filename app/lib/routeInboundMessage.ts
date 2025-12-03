// app/lib/routeInboundMessage.ts

type InboundIntent = {
  type: "STOP" | "HELP" | "POSITIVE" | "NEGATIVE" | "OTHER";
  score?: number;
};

/**
 * Central place to decide what to do with an inbound message
 * after we've:
 *   - saved it in `messages`
 *   - detected the intent (STOP / positive / etc)
 *
 * For now we keep DB changes minimal and just log system notes.
 * Later we can expand this to:
 *   - pause automation
 *   - mark lead HOT / NOT INTERESTED
 *   - create follow-up tasks
 */
export async function routeInboundMessage(opts: {
  supabase: any;             // Supabase client created in the API route
  messageId: string;         // id of the inbound row in `messages`
  leadId: string | null;     // may be null if we couldn't match a lead
  intent: InboundIntent;     // result from analyzeInboundIntent
  fromPhone: string;         // lead's phone
  toPhone: string;           // our Telnyx number
}) {
  const { supabase, messageId, leadId, intent, fromPhone, toPhone } = opts;

  // If we somehow don't have an intent, just bail
  if (!intent || !intent.type) {
    console.warn("[routeInboundMessage] Missing intent", {
      messageId,
      leadId,
      fromPhone,
    });
    return;
  }

  // Helper to insert a little system note into messages
  async function addSystemNote(body: string) {
    if (!leadId) return; // nothing to attach to

    const { error } = await supabase.from("messages").insert({
      lead_id: leadId,
      body,
      is_auto: true,
      direction: "SYSTEM",
    });

    if (error) {
      console.error("[routeInboundMessage] Failed to insert system note", error);
    }
  }

  switch (intent.type) {
    case "STOP": {
      // Carrier / compliance behaviour should eventually:
      // - mark lead as do-not-contact
      // - stop automation
      await addSystemNote(
        "System: Lead replied with STOP. You should stop messaging this contact unless they re-opt in."
      );
      break;
    }

    case "HELP": {
      await addSystemNote(
        "System: Lead requested HELP. Make sure your contact details and support info are visible."
      );
      break;
    }

    case "POSITIVE": {
      await addSystemNote(
        "System: Detected a positive reply. Consider marking this lead HOT and scheduling a follow-up call."
      );
      break;
    }

    case "NEGATIVE": {
      await addSystemNote(
        "System: Detected a negative reply. Consider marking this lead as Not Interested."
      );
      break;
    }

    case "OTHER":
    default: {
      // No special routing for now
      break;
    }
  }

  // Later we can also:
  // - auto-create tasks
  // - update lead status / automation flags
  // once we lock in the exact column names in your `leads` table.
}
