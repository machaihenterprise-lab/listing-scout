'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string | null;
  status: string | null;
};


export default function Home() {
  // Lead form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Lead list + loading / message state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Twilio test state
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  // Fetch leads from Supabase
  const fetchLeads = async () => {
    setLoadingLeads(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone, email, source, status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setMessage(`Error loading leads: ${error.message}`);
    } else {
      setLeads(data || []);
       if (!selectedLead && data && data.length > 0) {
    }
    setLoadingLeads(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Add a new lead + trigger Speed-to-Lead SMS
  // Add a new lead + log message + trigger Speed-to-Lead SMS
const addLead = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setMessage(null);

  // 1) Insert lead into Supabase
  const { data: leadRow, error: leadError } = await supabase
    .from('leads')
    .insert({
      name,
      phone,
      email,
      source: 'manual',
    })
    .select()
    .single();

  if (leadError) {
    console.error(leadError);
    setMessage(`Error: ${leadError.message}`);
    setLoading(false);
    return;
  }

  // 2) Insert initial message record
  await supabase.from('messages').insert({
    lead_id: leadRow.id,
    direction: 'OUTBOUND',
    channel: 'SMS',
    body: `Hi ${name}, got your request. Are you still thinking about selling this year?`,
  });

  // 3) Trigger Speed-to-Lead SMS (best effort)
  try {
    await fetch('/api/speed-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
  } catch (err) {
    console.error('SMS send failed:', err);
  }

  setMessage('✔️ Lead added and SMS triggered!');
  setName('');
  setPhone('');
  setEmail('');
  fetchLeads();
  setLoading(false);
};

  // Send test SMS via API route
  const sendTestSms = async () => {
    setSmsLoading(true);
    setSmsMessage(null);

    try {
      const res = await fetch('/api/test-sms', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setSmsMessage(`Error: ${data.error || 'Failed to send SMS'}`);
      } else {
        setSmsMessage('✅ Test SMS sent to your phone!');
      }
    } catch (err: any) {
      setSmsMessage(`Error: ${err.message || 'Failed to send SMS'}`);
    }

    setSmsLoading(false);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Listing Scout — Leads (Live)
      </h1>

      {/* Twilio test block */}
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid #ddd',
        }}
      >
              {/* HOT List */}
     <section
  style={{
    padding: '1.5rem',
    borderRadius: '1rem',
    border: '1px solid #ddd',
    marginBottom: '2rem',
  }}
>
  <h2 style={{ marginBottom: '0.75rem' }}>Leads to Call Now (HOT)</h2>

  {loadingLeads ? (
    <p>Loading leads...</p>
  ) : leads.length === 0 ? (
    <p>No HOT leads yet.</p>
  ) : (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      {leads
        .filter((l) => l.status === 'HOT')
        .map((lead) => (
          <li
            key={lead.id}
            onClick={() => {
              setSelectedLead(lead);
              setMessage(null);
            }}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              border: '1px solid #eee',
              marginBottom: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <strong>{lead.name}</strong> — {lead.phone}
          </li>
        ))}
    </ul>
  )}
</section>
          {smsLoading ? 'Sending…' : 'Send Test SMS'}
        </button>
        {smsMessage && (
          <p style={{ marginTop: '0.5rem' }}>{smsMessage}</p>
        )}
      </div>

      {/* Add Lead form */}
      <section
        style={{
          padding: '1.5rem',
          borderRadius: '1rem',
          border: '1px solid #ddd',
          marginBottom: '2rem',
        }}
      >
        <h2 style={{ marginBottom: '0.75rem' }}>Add Lead</h2>
        <form
          onSubmit={addLead}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
            }}
          />
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
            }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #ccc',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            {loading ? 'Saving…' : 'Add Lead'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: '0.75rem' }}>{message}</p>
        )}
      </section>

      {/* Leads list */}
      <section>
        <h2 style={{ marginBottom: '0.75rem' }}>Leads</h2>
        {loadingLeads ? (
          <p>Loading leads…</p>
        ) : leads.length === 0 ? (
          <p>No leads yet.</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {leads.map((lead) => (
              <li
                key={lead.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid #eee',
                  marginBottom: '0.5rem',
                }}
              >
                <strong>{lead.name}</strong> — {lead.phone} —{' '}
                {lead.email}
                {lead.source && (
                  <span
                    style={{
                      opacity: 0.6,
                      marginLeft: '0.5rem',
                    }}
                  >
                    ({lead.source})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
