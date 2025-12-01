// app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use Service Role here so we can set agent_id safely server-side
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Expected body:
 * {
 *   leadId: string;
 *   title: string;
 *   dueAt: string; // ISO date string
 * }
 */
export async function POST(req: Request) {
  try {
    const { leadId, title, dueAt } = await req.json();

    if (!leadId || !title || !dueAt) {
      return NextResponse.json(
        { error: "leadId, title, and dueAt are required" },
        { status: 400 }
      );
    }

    // 1. Get current user (agent)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();

    // Validate token and get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 401 });
    }

    const agentId = user.id;

    // 2. Insert into tasks table
    const {
      data: task,
      error: taskError,
    } = await supabase
      .from("tasks")
      .insert([
        {
          lead_id: leadId,
          agent_id: agentId,
          title,
          due_at: dueAt,
          // optional: priority: 'medium'
        },
      ])
      .select()
      .single();

    if (taskError) {
      console.error("Task insert error:", taskError);
      return NextResponse.json(
        { error: "Failed to create task", details: taskError.message },
        { status: 500 }
      );
    }

    // 3. Insert system message into messages table (optional but recommended)
    const humanReadableDate = new Date(dueAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const systemBody = `Task created: ${title} (Due: ${humanReadableDate})`;

    const { error: msgError } = await supabase.from("messages").insert([
      {
        lead_id: leadId,
        body: systemBody,
        message_type: "SYSTEM", // adapt if your enum is different
        is_private: true,
        sender_type: "system",
      },
    ]);

    if (msgError) {
      console.error("Message insert error:", msgError);
      // We don't fail the whole request if logging fails
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (err: any) {
    console.error("Unhandled error in /api/tasks:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}
