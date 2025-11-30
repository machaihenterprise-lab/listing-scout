import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lastSeen = body?.lastSeen;
    if (!lastSeen) {
      return NextResponse.json({ error: "lastSeen is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
    }

    // Query messages sent by the nurture bot (is_auto = true) since lastSeen
    const msgsUrl = `${supabaseUrl}/rest/v1/messages?select=created_at,is_auto&created_at=gte.${encodeURIComponent(
      lastSeen,
    )}&is_auto=eq.true`;

    const leadsUrl = `${supabaseUrl}/rest/v1/leads?select=created_at&id&created_at=gte.${encodeURIComponent(
      lastSeen,
    )}`;

    const errorsUrl = `${supabaseUrl}/rest/v1/delivery_errors?select=id&created_at=gte.${encodeURIComponent(
      lastSeen,
    )}`;

    const [msgsRes, leadsRes, errorsRes] = await Promise.all([
      fetch(msgsUrl, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      }),
      fetch(leadsRes ?? leadsUrl, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      }),
      fetch(errorsUrl, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      }),
    ]);

    if (!msgsRes.ok || !leadsRes.ok || !errorsRes.ok) {
      const mText = await msgsRes.text().catch(() => "");
      const lText = await leadsRes.text().catch(() => "");
      const eText = await errorsRes.text().catch(() => "");
      return NextResponse.json({ error: "Supabase REST error", details: { msgs: mText, leads: lText, errors: eText } }, { status: 502 });
    }

    const msgs = await msgsRes.json().catch(() => []);
    const leads = await leadsRes.json().catch(() => []);
    const errorsArr = await errorsRes.json().catch(() => []);

    const errors = Array.isArray(errorsArr) ? errorsArr.length : 0;

    return NextResponse.json({ ok: true, counts: { nurtureTexts: Array.isArray(msgs) ? msgs.length : 0, newLeads: Array.isArray(leads) ? leads.length : 0, errors } });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
