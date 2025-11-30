import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadId = body?.leadId;
    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

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
