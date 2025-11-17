import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

// Twilio will POST inbound SMS as x-www-form-urlencoded
export async function POST(request: Request) {
  try {
    // Read raw body and parse as URL-encoded form
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);

    const from = params.get('From') || '';
    const body = params.get('Body') || '';

    if (!from || !body) {
      // Missing key data – log but still return 200 so Twilio stops retrying
      console.error('Twilio inbound missing From or Body:', { from, body });
      return xmlOk();
    }

    // Normalize phone (digits only) so we can match formats like +1..., 1..., etc.
    const normalize = (phone: string) => phone.replace(/[^0-9]/g, '');

    const fromNormalized = normalize(from);

    // Fetch leads to find match by phone
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('id, phone');

    if (leadError) {
      console.error('Lead lookup error:', leadError);
    }

    let leadId: string | null = null;

    if (leads && leads.length > 0) {
      const match = leads.find((lead) => {
        const phone = (lead.phone || '') as string;
        return normalize(phone) === fromNormalized;
      });

      if (match) {
        // @ts-ignore – Supabase types are loose here
        leadId = match.id;
      }
    }

    // Insert INBOUND message row (even if we couldn't match a lead)
    const { error: msgError } = await supabase.from('messages').insert({
      lead_id: leadId,
      direction: 'INBOUND',
      channel: 'SMS',
      body,
    });

    if (msgError) {
      console.error('Failed to insert inbound message:', msgError);
    }

    // Always respond with empty TwiML so Twilio is satisfied
    return xmlOk();
  } catch (err) {
    console.error('Twilio inbound handler crashed:', err);
    return xmlOk();
  }
}

function xmlOk() {
  const twiml = `<Response></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
