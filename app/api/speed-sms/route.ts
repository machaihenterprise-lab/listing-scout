import { NextResponse } from 'next/server';
import { twilioClient, TWILIO_FROM_NUMBER } from '../../../lib/twilioClient';
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone } = body as { name?: string; phone?: string };

    if (!phone) {
      return NextResponse.json(
        { error: 'Missing phone number' },
        { status: 400 }
      );
    }

    const message = `Hi ${name || ''}, got your request. Are you still thinking about selling this year?`.trim();

    await twilioClient.messages.create({
      from: TWILIO_FROM_NUMBER,
      to: phone,
      body: message,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Speed SMS error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
