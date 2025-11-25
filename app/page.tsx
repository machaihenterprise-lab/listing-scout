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

  // New nurture fields (all optional so TS doesn’t complain)
  nurture_status?: string | null;
  nurture_stage?: string | null;
  next_nurture_at?: string | null;      // timestamptz comes back as string
  last_nurture_sent_at?: string | null;
  last_agent_sent_at?: string | null;
  nurture_locked_until?: string | null;
};


type MessageRow = {
  id: string;
  lead_id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: string | null;
  body: string;
  created_at: string;
};

function Header() {
  return (
    <header
      style={{
        width: "100%",
        padding: "1rem 2rem",
        marginBottom: "2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Logo / Title */}
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        Listing Scout
      </h2>

      {/* Desktop Navigation */}
      <nav style={{ display: "flex", gap: "1.5rem" }} className="hidden lg:flex">
        <a href="#" style={{ opacity: 0.8 }}>Leads</a>
        <a href="#" style={{ opacity: 0.8 }}>Settings</a>
        <a href="#" style={{ opacity: 0.8 }}>Account</a>
      </nav>

      {/* Mobile Menu Icon */}
      <div className="lg:hidden">
        <span style={{ fontSize: "1.5rem" }}>☰</span>
      </div>
    </header>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const normalized = (status || "").toUpperCase();

  const base =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

  if (normalized === "HOT") {
    return (
      <span className={`${base} bg-red-500/15 text-red-400 border border-red-500/30`}>
        🔥 HOT
      </span>
    );
  }

  if (normalized === "NURTURE") {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-300 border border-emerald-500/20`}>
        🌱 Nurture
      </span>
    );
  }

  return (
    <span className={`${base} bg-slate-500/10 text-slate-300 border border-slate-500/20`}>
      {normalized || "UNKNOWN"}
    </span>
  );
}

export default function Home() {
  // Lead form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Lead list + loading / message state
  const [loading, setLoading] = useState(false); // for Add Lead form
  const [message, setMessage] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [conversation, setConversation] = useState<MessageRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Reply box state
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Twilio test state
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  const handleSendTestSms = async () => {
  // simple no-op test handler for now
  console.log("Test SMS button clicked");
  setSmsLoading(true);
  try {
  // later we can call a real test endpoint here
  setSmsMessage("Test SMS button clicked (no SMS sent in test mode).");
  } finally {
  setSmsLoading(false);
  }
  };

  // Fetch leads from Supabase
 const fetchLeads = async () => {
  setLoadingLeads(true);

  try {
    const { data, error } = await supabase
      .from('leads')
      // safest for now: grab everything so we don't break on column names
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error when loading leads:', error);
      setMessage(`Error loading leads: ${error.message || 'Unknown error'}`);
      return;
    }

    console.log('Loaded leads:', data);
    const leadsData = (data || []) as Lead[];

    setLeads(leadsData);

    // Auto-select first HOT lead if none selected yet
    if (!selectedLead && leadsData.length > 0) {
      setSelectedLead(leadsData[0]);
    }
  } catch (err: any) {
    console.error('Error loading leads:', err);
    setMessage(`Error loading leads: ${err.message || 'Unknown error'}`);
  } finally {
    // ALWAYS turn off the loading spinner
    setLoadingLeads(false);
  }
};


  // Fetch all messages for a lead
  const fetchMessages = async (leadId: string) => {
    if (!leadId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      setMessage(`Error loading messages: ${error.message}`);
      return;
    }

    setConversation((data || []) as MessageRow[]);
  };

  // When you click a HOT lead in the list
  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setMessage(null);
    await fetchMessages(lead.id);
  };

  // Send reply SMS for the selected lead
 const handleSendReply = async () => {
  if (!selectedLead) {
    setMessage('Please select a lead first.');
    return;
  }

  const trimmed = replyText.trim();
  if (!trimmed) return;

  try {
    setSendingReply(true);
    setMessage(null);

    const res = await fetch('/api/reply-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: selectedLead.id,
        to: selectedLead.phone,
        body: trimmed,
      }),
    });

    // Try to parse JSON, but don't explode if it's not valid
    const data = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      console.error('reply-sms API returned error', res.status, data);
      setMessage(
        data?.error ||
          `Error sending reply (status ${res.status}). Check server logs.`
      );
      return;
    }

    // Clear the input
    setReplyText('');

    // Refresh conversation so the new outbound message shows up
    await fetchMessages(selectedLead.id);
  } catch (err: any) {
    console.error('Error sending reply:', err);
    setMessage(err?.message || 'Error sending reply');
  } finally {
    setSendingReply(false);
  }
};

  // Add a new HOT lead (form at the bottom-left)
  const addLead = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
   const { error } = await supabase.from("leads").insert({
   name,
   phone,
   email,
   source: "manual",                     // keep your existing value if different
   status: "NURTURE",                        // this form is for HOT leads
   nurture_status: "ACTIVE",             // included in edge-function filter
   nurture_stage: "DAY_1",               // start at day 1
   next_nurture_at: new Date().toISOString(), // schedule first nurture SMS
});

      if (error) {
        throw error;
      }

      setName('');
      setPhone('');
      setEmail('');
      setMessage('Lead added successfully.');

      // Reload leads so the new one appears in the HOT list
      await fetchLeads();
    } catch (err: any) {
      console.error('Error adding lead:', err);
      setMessage(`Error adding lead: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Twilio “Send Test SMS” button
  const sendTestSms = async () => {
    try {
      setSmsLoading(true);
      setSmsMessage(null);

      const res = await fetch('/api/test-sms', {
        method: 'POST',
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'Failed to send SMS');
      }

      setSmsMessage('Test SMS sent!');
    } catch (err: any) {
      console.error(err);
      setSmsMessage(err.message || 'Error sending test SMS');
    } finally {
      setSmsLoading(false);
    }
  };

  // Load leads on first render
  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
  // If no lead is selected yet, don't start polling
  if (!selectedLead) return;

  // Load messages immediately when a lead is selected
  fetchMessages(selectedLead.id);

  // Then poll every 5 seconds for new messages
  const intervalId = setInterval(() => {
    fetchMessages(selectedLead.id);
  }, 5000); // 5000ms = 5 seconds

  // Cleanup when selected lead changes or component unmounts
  return () => clearInterval(intervalId);
}, [selectedLead?.id]);


  return (
  <>
    <Header />
   
    <main
      style={{
        minHeight: '100vh',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#f9fafb',
        backgroundColor: '#020617',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>
        Listing Scout — Leads (Live)
      </h1>

      <div className="flex flex-col gap-6 items-stretch lg:flex-row lg:items-start">
        
        {/* LEFT COLUMN */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Twilio test block */}
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '1rem',
              border: '1px solid #1f2937',
            }}
          >
            <h2 style={{ marginBottom: '0.75rem' }}>Twilio Test</h2>
            
            <button
              type="button"
              disabled={smsLoading}
              onClick={handleSendTestSms}
           >
             {smsLoading ? "Sending…" : "Send Test SMS"}
            </button>

            {smsMessage && (
             <p style={{ marginTop: "0.5rem" }}>{smsMessage}</p>
      )}

          </div>

          {/* HOT List */}
          <section
            style={{
              padding: '1.5rem',
              borderRadius: '1rem',
              border: '1px solid #1f2937',
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
                  .filter((l) => l.status === "HOT")
                  .map((lead) => {
                  const isSelected = selectedLead && selectedLead.id === lead.id;

                 return (
                   <li
                     key={lead.id}
                     onClick={() => handleSelectLead(lead)}
                     style={{
                      padding: "0.9rem 1rem",
                      borderRadius: "0.9rem",
                      marginBottom: "0.75rem",
                      cursor: "pointer",
                      border: isSelected ? "1px solid #fbbf24" : "1px solid #1f2937",
                      background:
                       isSelected
                         ? "radial-gradient(circle at top left, rgba(251,191,36,0.18), #020617)"
                         : "#020617",
                      boxShadow: isSelected
                        ? "0 12px 24px rgba(0,0,0,0.7)"
                        : "0 8px 18px rgba(0,0,0,0.55)",
                      transition: "background 150ms ease, box-shadow 150ms ease, transform 120ms ease",
                    }}
                     className="hover:-translate-y-[1px] hover:shadow-lg"

                 >
                   <div
                     style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     width: "100%",
                   }}
                 >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                     <strong>{lead.name || "Unnamed lead"}</strong>
                     <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>📞 {lead.phone}</span>
                     {lead.email && (
                       <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>📧 {lead.email}</span>
                     )}
                   </div>

                   <StatusPill status={lead.status} />
                  </div>

               </li>
          );
       })}

              </ul>
            )}
          </section>

          {/* Add Lead form */}
          <section
            style={{
              padding: '1.5rem',
              borderRadius: '1rem',
              border: '1px solid #1f2937',
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
                  border: '1px solid #374151',
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
                  border: '1px solid #374151',
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
                  border: '1px solid #374151',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {loading ? 'Adding…' : 'Add Lead'}
              </button>
            </form>
            {message && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                {message}
              </p>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Conversation view */}
<aside
  style={{
    padding: '1.5rem',
    borderRadius: '1rem',
    border: '1px solid #ddd',
    alignSelf: 'flex-start',
  }}
>
  <h2 style={{ marginBottom: '0.75rem' }}>Conversation</h2>

  {!selectedLead ? (
    <p style={{ color: '#aaa' }}>
      Select a HOT lead on the left to see their details and SMS conversation here.
    </p>
  ) : (
    <div>
      {/* Lead header */}
      <p style={{ marginBottom: '0.25rem' }}>
        <strong>{selectedLead.name}</strong>
      </p>
      <p style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
        📞 {selectedLead.phone}
      </p>
      <p style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
        ✉️ {selectedLead.email}
      </p>
     <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
     <span style={{ color: '#aaa', marginRight: '0.35rem' }}>Status:</span>
     <StatusPill status={selectedLead?.status} />
     </div>

      {/* Messages list */}
      <div
        style={{
          borderRadius: '0.75rem',
          border: '1px solid #444',
          padding: '0.75rem 1rem',
          maxHeight: '260px',
          overflowY: 'auto',
          marginBottom: '0.75rem',
        }}
      >
        {conversation.length === 0 ? (
          <p style={{ color: '#aaa', margin: 0 }}>
            No messages for this lead yet.
          </p>
        ) : (
          conversation.map((msg: any) => {
            const isInbound = msg.direction === 'INBOUND';
            return (
              <div
                key={msg.id}
                style={{
                  marginBottom: '0.5rem',
                  textAlign: isInbound ? 'left' : 'right',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #555',
                    backgroundColor: isInbound ? '#111' : '#1a1a2a',
                    maxWidth: '100%',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg.body}</p>
                </div>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.7rem',
                    color: '#888',
                  }}
                >
                  {isInbound ? 'From lead' : 'You'} ·{' '}
                  {new Date(msg.created_at).toLocaleString()}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Reply form */}
      <div
        onSubmit={handleSendReply}
  style={{
    marginTop: '1rem',
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  }}
>
  <input
    type="text"
    placeholder={
      selectedLead ? 'Type a reply to this lead...' : 'Select a lead to reply...'
    }
    value={replyText}
    onChange={(e) => setReplyText(e.target.value)}
    disabled={!selectedLead || sendingReply}
    style={{
      flex: 1,
      padding: '0.5rem 0.75rem',
      borderRadius: '0.75rem',
      border: '1px solid #555',
      backgroundColor: '#050016',
      color: '#fff',
      fontSize: '0.9rem',
    }}
  />
  <button
    type="button"
    onClick={handleSendReply}
    disabled={
      !selectedLead || sendingReply || replyText.trim().length === 0
    }
    style={{
      padding: '0.5rem 1rem',
      borderRadius: '999px',
      border: 'none',
      cursor:
        !selectedLead || sendingReply || replyText.trim().length === 0
          ? 'not-allowed'
          : 'pointer',
      fontSize: '0.9rem',
      opacity:
        !selectedLead || sendingReply || replyText.trim().length === 0
          ? 0.5
          : 1,
    }}
  >
    {sendingReply ? 'Sending…' : 'Send'}
  </button>
</div>

      <p
        style={{
          fontSize: '0.8rem',
          color: '#555',
          margin: 0,
        }}
      >
        Replies here send an SMS to this lead and are logged in the conversation
        above.
      </p>
    </div>
  )}
</aside>
      </div>
        </main>
  </>
);
}
