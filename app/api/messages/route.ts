import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type MessageBody = {
  leadId?: string;
  body?: string;
  message_type?: string;
  sender_type?: string;
  channel?: string;
  direction?: string;
  is_private?: boolean;
  is_auto?: boolean;
  id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as MessageBody;
    const leadId = body?.leadId;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "Supabase configuration missing",
          detail:
            "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ---------------------------------------------------
    // 1) CREATE MESSAGE (SMS or NOTE) when message_type is present
    // ---------------------------------------------------
    if (body?.message_type) {
      if (!body.body || typeof body.body !== "string") {
        return NextResponse.json(
          { error: "message body is required" },
          { status: 400 }
        );
      }

      const isNote = body.message_type === "NOTE";
      const insertPayload = {
        lead_id: leadId,
        body: body.body as string,

        // new fields
        message_type: isNote ? "NOTE" : (body.message_type as string),
        is_private: isNote ? true : Boolean(body.is_private ?? false),
        sender_type: isNote ? "agent" : ((body.sender_type as string | undefined) ?? "agent"),

        // existing fields in your messages table
        channel: (body.channel as string | undefined) ?? (isNote ? "note" : "sms"),
        direction: (body.direction as string | undefined) ?? "OUTBOUND",
        is_auto: body.is_auto ?? false,
      };

      const tryInsert = async (payload: Record<string, unknown>) =>
        supabase.from("messages").insert(payload).select("*").single();

      let { data, error } = await tryInsert(insertPayload);

      // Fallback: if the schema doesn't have some columns (e.g., message_type/sender_type),
      // retry with a minimal payload.
      if (error) {
        const minimalPayload = {
          lead_id: leadId,
          body: body.body as string,
          channel: (body.channel as string | undefined) ?? (isNote ? "note" : "sms"),
          direction: "OUTBOUND",
        };

        const minimalResult = await tryInsert(minimalPayload);
        data = minimalResult.data;
        error = minimalResult.error;
      }

      if (error) {
        return NextResponse.json(
          { error: "Insert failed", detail: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: data }, { status: 200 });
    }

    // ---------------------------------------------------
    // 2) FETCH MESSAGES for this lead when no message_type provided
    // ---------------------------------------------------

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Fetch failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as MessageBody;
    const { id, leadId, body: noteBody } = body;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!id || !noteBody) {
      return NextResponse.json({ error: "id and body are required" }, { status: 400 });
    }
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("messages")
      .update({
        body: noteBody,
        message_type: "NOTE",
        is_private: true,
        sender_type: "agent",
        channel: "note",
      })
      .eq("id", id)
      .eq("lead_id", leadId ?? undefined)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "Update failed", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: data }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as MessageBody;
    const { id, leadId } = body;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const query = supabase.from("messages").delete().eq("id", id);
    if (leadId) {
      query.eq("lead_id", leadId);
    }
    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: "Delete failed", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
