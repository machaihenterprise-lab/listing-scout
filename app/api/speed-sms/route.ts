import { NextResponse } from "next/server";

type SpeedSmsPayload = { name?: string; phone?: string };

async function sendTelnyxSms(to: string, body: string) {
  const apiKey = process.env.TELNYX_API_KEY;
  const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
  const fromNumber = process.env.TELNYX_US_NUMBER;

  if (!apiKey || !profileId || !fromNumber) {
    throw new Error("Telnyx environment variables are not set");
  }

  const telnyxRes = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromNumber,
      to,
      text: body,
      messaging_profile_id: profileId,
    }),
  });

  if (!telnyxRes.ok) {
    const telnyxJson = await telnyxRes.json().catch(() => ({}));
    const detail =
      telnyxJson?.errors?.[0]?.detail ||
      `Failed to send SMS via Telnyx (status ${telnyxRes.status})`;
    throw new Error(detail);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone } = body as SpeedSmsPayload;

    if (!phone) {
      return NextResponse.json(
        { error: "Missing phone number" },
        { status: 400 }
      );
    }

    const message = `Hi ${
      name || ""
    }, got your request. Are you still thinking about selling this year?`.trim();

    await sendTelnyxSms(phone, message);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error sending SMS";
    console.error("Speed SMS error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
