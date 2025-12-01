import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadId = body?.leadId;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing", detail: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
    }

    // --- NEW BLOCK: Handle message creation (SMS or NOTE) ---
    if (body?.message_type) {
      if (!body.body || typeof body.body !== "string") {
        return NextResponse.json({ error: "message body is required" }, { status: 400 });
      }

      const insertPayload = {
        lead_id: leadId,
        body: body.body,
        message_type: body.message_type === "NOTE" ? "NOTE" : body.message_type,
        is_private: body.message_type === "NOTE" ? true : body.is_private ?? false,
        sender_type: body.message_type === "NOTE" ? "agent" : body.sender_type ?? "agent",
      };

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/messages`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(insertPayload),
      });

      if (!insertRes.ok) {
        const text = await insertRes.text().catch(() => "");
        return NextResponse.json({ error: "Insert failed", detail: text }, { status: 500 });
      }

      const data = await insertRes.json();
      return NextResponse.json({ message: data }, { status: 200 });
    }
    // --- END NEW BLOCK ---

    const url = `${supabaseUrl}/rest/v1/messages?select=*&lead_id=eq.${encodeURIComponent(
      leadId,
    )}&order=created_at.asc`;

    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Supabase REST error: ${res.status}`, detail: text }, { status: 502 });
    }

    const data = await res.json().catch(() => []);
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
