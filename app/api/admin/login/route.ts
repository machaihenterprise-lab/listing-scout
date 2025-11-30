import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = body?.password;

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return NextResponse.json({ error: "Admin password not configured" }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    // Set an httpOnly cookie for server-rendered pages to check
    res.cookies.set("listing_scout_admin", "1", {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });

    return res;
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
