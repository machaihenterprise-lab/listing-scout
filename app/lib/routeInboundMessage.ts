// app/lib/routeInboundMessage.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboundIntent } from "./inboundIntent";

type RouteInboundArgs = {
  supabase: SupabaseClient<any, "public", any>;
  lead: any | null;      // row from leads table (can tighten later)
  message: any;          // row from messages table
  intent: InboundIntent;
};

/**
 * Decide what to do with an inbound message:
 * - STOP: mark nurture stopped, clear future nurtures
 * - POSITIVE: pause nurture + create follow-up task for agent
 * - NOT_NOW: push next_nurture_at into the future
 * - NEGATIVE: close out nurture
 * - QUESTION / UNKNOWN: leave nurture running for now
 */
export async function routeInboundMessage({
  supabase,
  lead,
  message,
  intent,
}: RouteInboundArgs): Promise<void> {
  if (!lead) {
    console.warn("[routeInboundMessage] No lead found for inbound message", message?.id);
    return;
  }

  const leadId = lead.id as string;
  const nowIso = new Date().toISOString();

  console.log("[routeInboundMessage] intent.kind =", intent.kind, "leadId =", leadId);

  try {
    switch (intent.kind) {
      case "STOP": {
        // Hard opt-out
        const { error } = await supabase
          .from("leads")
          .update({
            nurture_status: "STOPPED",
            next_nurture_at: null,
            nurture_locked_until: null,
          })
          .eq("id", leadId);

        if (error) throw error;
        break;
      }

      case "POSITIVE": {
        // Lead is engaged — create a follow-up task and pause automation
        const leadName = lead.name || lead.full_name || "this lead";

        const { error: taskError } = await supabase.from("tasks").insert({
          lead_id: leadId,
          agent_id: lead.agent_id ?? null,
          title: `Follow up with ${leadName} about moving`,
          notes: `Auto-created from SMS reply: "${message.body}"`,
          due_at: nowIso,
          priority: "high",
          is_completed: false,
        });

        if (taskError) throw taskError;

        const { error: leadError } = await supabase
          .from("leads")
          .update({
            nurture_status: "ENGAGED",
            // pause future automated drips until agent handles it
            next_nurture_at: null,
            nurture_locked_until: null,
          })
          .eq("id", leadId);

        if (leadError) throw leadError;

        break;
      }

      case "NOT_NOW": {
        // Push them into a long-term nurture bucket
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const next = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

        const { error } = await supabase
          .from("leads")
          .update({
            nurture_status: "ACTIVE",
            nurture_stage: "LONG_TERM",
            next_nurture_at: next,
            nurture_locked_until: null,
          })
          .eq("id", leadId);

        if (error) throw error;
        break;
      }

      case "NEGATIVE": {
        // Not interested, or already sold
        const { error } = await supabase
          .from("leads")
          .update({
            nurture_status: "CLOSED",
            next_nurture_at: null,
            nurture_locked_until: null,
          })
          .eq("id", leadId);

        if (error) throw error;
        break;
      }

      case "QUESTION":
      case "UNKNOWN":
      default: {
        // For now, do nothing special – still logged in messages table.
        // Later we can auto-create "Answer this question" tasks.
        break;
      }
    }
  } catch (err) {
    console.error("[routeInboundMessage] error applying routing logic:", err);
  }
}
