import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // SignalWire sends JSON payload by default
    const payload = await req.json();

    console.log("SIGNALWIRE_INBOUND", payload);

    // Temporary response until we add real logic
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error parsing SignalWire webhook", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}