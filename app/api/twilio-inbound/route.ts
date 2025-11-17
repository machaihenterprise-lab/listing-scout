import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

// Twilio will POST inbound SMS data as form-encoded.
// We'll:
// 1) read From + Body
// 2) find the lead with matching phone
// 3) insert INBOUND/SMS message row

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const from = String(formData.get('From') || '').trim();
    const body = String(formData.get('Body') || '').trim();

    if (!from || !body) {
      return NextResponse.json(
        { error: 'Missing From or Body' },
        { status: 400 }
      );
    }

    // Normalize phone: Twilio sends in E.164 like +15555550123
    const fromNumber = from;

    // Find lead with this phone
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', fromNumber)
      .single();

    if (leadError) {
      console.error('Lead lookup error:', leadError.message);
      // We still return 200 so Twilio doesn't retry forever
      return NextResponse.json({ ok: true });
    }

    if (!lead) {
      console.warn('No lead found for inbound SMS from:', fromNumber);
      return NextResponse.json({ ok: true });
    }

    // Insert INBOUND message row
    const { error: msgError } = await supabase.from('messages').insert({
      lead_id: lead.id,
      direction: 'INBOUND',
      channel: 'SMS',
      body,
    });

    if (msgError) {
      console.error('Failed to insert inbound message:', msgError.message);
    }

    // Twilio just needs a 200 response; content can be empty or simple text.
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('Twilio inbound handler error:', err?.message || err);
    return new NextResponse('Error', { status: 200 }); // still 200 for Twilio
  }
}
