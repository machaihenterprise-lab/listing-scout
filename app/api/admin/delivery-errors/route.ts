import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action;
    const ids = body?.ids as string[] | undefined;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (action === "clear_all") {
      const { error } = await supabase.from("delivery_errors").delete().neq("id", "null");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const { error } = await supabase.from("delivery_errors").delete().in("id", ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
