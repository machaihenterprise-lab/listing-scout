import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const leadId = body["leadId"] as string | undefined;
    const description = body["description"] as string | undefined;
    const dueAt = body["dueAt"] as string | null | undefined;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

    if (!leadId || !description) {
      return NextResponse.json({ error: "leadId and description are required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const insertPayload: Record<string, unknown> = {
      lead_id: leadId,
      description,
      status: "OPEN",
    };

    if (dueAt) {
      insertPayload["due_at"] = dueAt;
    }

    const { data, error } = await supabase.from("tasks").insert(insertPayload).select("*").single();

    if (error) {
      return NextResponse.json({ error: "Insert failed", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, task: data }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
