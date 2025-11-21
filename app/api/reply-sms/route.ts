import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabase } from '../../../lib/supabaseClient';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn(
    'Twilio env vars missing. ' +
      'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER must be set.'
  );
}

const twilioClient =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function POST(req: Request) {
  try {
    const bodyJson = await req.json().catch((err) => {
      console.error('Error parsing JSON in /api/reply-sms:', err);
      return null;
    });

    if (!bodyJson) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { leadId, to, body } = bodyJson as {
      leadId?: string;
      to?: string;
      body?: string;
    };

    if (!leadId || !to || !body) {
      return NextResponse.json(
        { error: 'Missing required fields (leadId, to, body)' },
        { status: 400 }
      );
    }

    if (!twilioClient || !fromNumber) {
      console.error('Twilio client not configured correctly.');
      return NextResponse.json(
        { error: 'Server SMS configuration error' },
        { status: 500 }
      );
    }

    // 1) Send SMS via Twilio
    let twilioSid: string | null = null;
    try {
      const twilioMsg = await twilioClient.messages.create({
        to,
        from: fromNumber,
        body,
      });
      twilioSid = twilioMsg.sid;
    } catch (err: any) {
      console.error('Twilio send error in /api/reply-sms:', err);
      return NextResponse.json(
        { error: err?.message || 'Twilio failed to send SMS' },
        { status: 500 }
      );
    }

    // 2) Try to log OUTBOUND SMS into Supabase messages table
    //    but DO NOT fail the whole request if logging breaks.
    let logged = true;
    let logError: string | null = null;

    try {
      const { error: insertError } = await supabase.from('messages').insert({
        lead_id: leadId,
        direction: 'OUTBOUND',
        channel: 'SMS',
        body,
      });

      if (insertError) {
        logged = false;
        logError = insertError.message || String(insertError);
        console.error(
          'Error inserting outbound message into Supabase:',
          insertError
        );
      }
    } catch (err: any) {
      logged = false;
      logError = err?.message || String(err);
      console.error(
        'Unexpected error inserting outbound message into Supabase:',
        err
      );
    }

    // Even if logging failed, SMS was sent successfully.
    return NextResponse.json(
      {
        success: true,
        twilioSid,
        logged,
        logError,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unexpected error in /api/reply-sms route:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected server error in reply-sms' },
      { status: 500 }
    );
  }
}
