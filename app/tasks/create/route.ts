import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const required = ["lead_id", "agent_id", "title"];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        lead_id: body.lead_id,
        agent_id: body.agent_id,
        title: body.title,
        notes: body.notes || "",
        due_at: body.due_at || null,
        priority: body.priority || "medium",
        is_completed: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ task: data }, { status: 200 });
  } catch (err: any) {
    console.error("Unexpected API error:", err);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
