import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { task_id, is_completed } = await req.json();

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed })
      .eq("id", task_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error updating task:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to update task" },
      { status: 500 }
    );
  }
}
