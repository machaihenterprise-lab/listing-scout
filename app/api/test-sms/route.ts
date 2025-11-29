import { NextResponse } from "next/server";

async function sendTelnyxTestSms(to: string) {
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
      text: "👋 Listing Scout test SMS — if you see this, Telnyx is working!",
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

export async function POST() {
  try {
    const toNumber = process.env.DEV_TEST_PHONE;

    if (!toNumber) {
      return NextResponse.json(
        { error: "DEV_TEST_PHONE not set in env" },
        { status: 400 }
      );
    }

    await sendTelnyxTestSms(toNumber);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error sending SMS";
    console.error("Telnyx error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
