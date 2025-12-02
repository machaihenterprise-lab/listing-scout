import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn("[activity-summary] Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
      return NextResponse.json(
        { ok: false, error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const lastSeen: string | undefined = body?.lastSeen;

    // If the UI didn't send lastSeen, default to "last 24 hours"
    let since: Date;
    if (lastSeen) {
      since = new Date(lastSeen);
      if (isNaN(since.getTime())) {
        // Bad date → still fall back to 24h
        since = new Date();
        since.setDate(since.getDate() - 1);
      }
    } else {
      since = new Date();
      since.setDate(since.getDate() - 1);
    }
    const sinceIso = since.toISOString();

    // 1) Auto outbound messages (bot nurture)
    const { count: autoOutboundCount, error: autoErr } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "OUTBOUND")
      // if you don't have is_auto yet, comment out this line:
      .eq("is_auto", true)
      .gte("created_at", sinceIso);

    if (autoErr) throw autoErr;

    // 2) Inbound replies from leads
    const { count: inboundReplyCount, error: inboundErr } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "INBOUND")
      .gte("created_at", sinceIso);

    if (inboundErr) throw inboundErr;

    // 3) Unique leads touched (any messages)
    const { data: touchedRows, error: touchedErr } = await supabase
      .from("messages")
      .select("lead_id")
      .gte("created_at", sinceIso);

    if (touchedErr) throw touchedErr;

    const uniqueLeadIds = new Set(
      (touchedRows || [])
        .map((row: any) => row.lead_id)
        .filter((id: string | null) => !!id)
    );

    // 4) New leads created
    const { count: newLeadsCount, error: newLeadsErr } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceIso);

    if (newLeadsErr) throw newLeadsErr;

    // 5) Tasks created
    const { count: tasksCreatedCount, error: tasksErr } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceIso);

    if (tasksErr) throw tasksErr;

    return NextResponse.json(
      {
        ok: true,
        since: sinceIso,
        auto_outbound_count: autoOutboundCount ?? 0,
        inbound_reply_count: inboundReplyCount ?? 0,
        leads_touched_count: uniqueLeadIds.size,
        new_leads_count: newLeadsCount ?? 0,
        tasks_created_count: tasksCreatedCount ?? 0,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /api/activity-summary:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to load activity summary" },
      { status: 500 }
    );
  }
}
