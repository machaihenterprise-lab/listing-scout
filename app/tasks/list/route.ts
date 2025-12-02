import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("lead_id");
  const agentId = url.searchParams.get("agent_id");

  let query = supabase.from("tasks").select("*").order("due_at", { ascending: true });

  if (leadId) query = query.eq("lead_id", leadId);
  if (agentId) query = query.eq("agent_id", agentId);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tasks: data ?? [] });
}
