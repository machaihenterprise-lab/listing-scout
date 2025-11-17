import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

// Twilio posts application/x-www-form-urlencoded.
// We'll parse it manually using URLSearchParams.
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

    const from = (params.get('From') || '').trim();
    const body = (params.get('Body') || '').trim();

    if (!from || !body) {
      console.error('Missing From or Body in Twilio webhook', { from, body });
      // Still return 200 so Twilio doesn't keep retrying
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const fromNumber = from; // e.g. +14342095253

    // Find lead with this phone
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', fromNumber)
      .single();

    if (leadError) {
      console.error('Lead lookup error:', leadError.message);
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    if (!lead) {
      console.warn('No lead found for inbound SMS from:', fromNumber);
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const { error: msgError } = await supabase.from('messages').insert({
      lead_id: lead.id,
      direction: 'INBOUND',
      channel: 'SMS',
      body,
    });

    if (msgError) {
      console.error('Failed to insert inbound message:', msgError.message);
    }

    // Respond with empty TwiML so Twilio is happy
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err: any) {
    console.error('Twilio inbound handler crashed', err);
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
