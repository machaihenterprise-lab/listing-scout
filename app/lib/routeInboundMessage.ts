// app/lib/routeInboundMessage.ts
import type { InboundIntent } from "./inboundIntent";

type RouteInboundParams = {
  supabase: any;        // we can tighten this later
  message: any;         // the inserted message row
  lead: any | null;     // lead row, or null if not matched
  intent: InboundIntent;
};

export async function routeInboundMessage({
  supabase,
  message,
  lead,
  intent,
}: RouteInboundParams): Promise<void> {
  try {
    if (!lead) {
      console.warn(
        "[routeInboundMessage] No lead found for inbound message",
        message?.id
      );
      return;
    }

    const leadId = lead.id as string;

    // 1) System note summarizing what we detected
    let noteBody: string;

    switch (intent.type) {
      case "STOP":
        noteBody =
          "📵 Lead replied with an opt-out keyword (STOP/UNSUBSCRIBE). Automation should remain paused for this lead.";
        break;
      case "HELP":
        noteBody =
          "❓ Lead asked for help / more info. Consider replying manually to clarify who you are and why you're texting.";
        break;
      case "POSITIVE":
        noteBody =
          "🔥 Lead replied positively / with interest. This lead may be HOT and ready for follow-up.";
        break;
      case "NEGATIVE":
        noteBody =
          "🙅 Lead replied negatively / not interested. You may want to pause future outreach.";
        break;
      default:
        noteBody =
          "📩 New inbound reply received. Review the conversation and decide next steps.";
        break;
    }

    await supabase.from("messages").insert({
      lead_id: leadId,
      direction: "SYSTEM",
      channel: "SMS",
      body: noteBody,
      is_auto: true,
    });

    // 2) Optional lead updates. Wrap in try/catch in case these columns
    //     don't exist yet in your schema.
    if (intent.type === "STOP") {
      try {
        await supabase
          .from("leads")
          .update({
            status: "opt_out",         // only if your schema has this
            automation_paused: true,   // only if your schema has this
          })
          .eq("id", leadId);
      } catch (err) {
        console.warn(
          "[routeInboundMessage] Could not update lead for STOP intent:",
          err
        );
      }
    }

    if (intent.type === "POSITIVE") {
      try {
        await supabase
          .from("leads")
          .update({
            status: "hot",             // matches your HOT pill if you use it
          })
          .eq("id", leadId);
      } catch (err) {
        console.warn(
          "[routeInboundMessage] Could not update lead for POSITIVE intent:",
          err
        );
      }
    }
  } catch (err) {
    console.error("[routeInboundMessage] Error routing inbound message:", err);
  }
}
