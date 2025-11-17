import { NextResponse } from 'next/server';
import { twilioClient, TWILIO_FROM_NUMBER } from '../../../lib/twilioClient';

export async function POST() {
  try {
    const toNumber = process.env.DEV_TEST_PHONE;

    if (!toNumber) {
      return NextResponse.json(
        { error: 'DEV_TEST_PHONE not set in env' },
        { status: 400 }
      );
    }

    await twilioClient.messages.create({
      from: TWILIO_FROM_NUMBER,
      to: toNumber,
      body: '👋 Listing Scout test SMS — if you see this, Twilio is working!',
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Twilio error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
