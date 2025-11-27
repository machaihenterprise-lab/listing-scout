'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

type Lead = {
  id: string;
  created_at?: string | null; 
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
  lastContactedAt?: string | null; // ISO timestamp or null
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
     <nav
      className="hidden lg:flex"
      style={{ gap: '1.5rem' }}
    >
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

function formatShortDateTime(dateString: string | null | undefined) {
  if (!dateString) return "";
  const d = new Date(dateString);

  const datePart = d.toLocaleDateString("en-US", {
    month: "short", // Nov
    day: "numeric", // 27
  });

  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} at ${timePart}`;
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

  // Pause automation state (NEW)
  const [automationPaused, setAutomationPaused] = useState(false);

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
    if (!data) {
  setLeads([]);
  return;
}

const mappedLeads: Lead[] = data.map((row: any) => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  source: row.source,
  status: row.status,

  nurture_status: row.nurture_status,
  nurture_stage: row.nurture_stage,
  next_nurture_at: row.next_nurture_at,
  last_nurture_sent_at: row.last_nurture_sent_at,
  last_agent_sent_at: row.last_agent_sent_at,
  nurture_locked_until: row.nurture_locked_until,

  // 👇 new field we introduced
  lastContactedAt: row.last_contacted_at ?? null,
}));

setLeads(mappedLeads);

    // Auto-select first HOT lead if none selected yet
if (!selectedLead && mappedLeads.length > 0) {
  setSelectedLead(mappedLeads[0]);
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
     // Update last_contacted_at timestamp for this lead
      await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", selectedLead.id);

     // Refresh leads so UI shows updated “Last contacted”
      await fetchLeads();

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

  useEffect(() => {
  // For now, reset when switching leads.
  // Later we’ll sync this to a Supabase column instead.
  setAutomationPaused(false);
}, [selectedLead?.id]);


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
          minHeight: "100vh",
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "2rem 1rem",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#f9fafb",
          backgroundColor: "#020617",
        }}
      >
        {/* Title + stats */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              marginBottom: "0.25rem",
            }}
          >
            Leads Dashboard
          </h1>
          <p
            style={{
              color: "#b4b4b4",
              fontSize: "0.95rem",
              marginBottom: "0.75rem",
            }}
          >
            Your active pipeline
          </p>

          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              fontSize: "0.85rem",
            }}
          >
            <span
              style={{
                backgroundColor: "rgba(255, 99, 71, 0.08)",
                padding: "0.35rem 0.75rem",
                borderRadius: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              🔥 {leads.filter((l) => l.status === "HOT").length} Hot
            </span>

            <span
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                padding: "0.35rem 0.75rem",
                borderRadius: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              🌱 {leads.filter((l) => l.status === "NURTURE").length} Nurture
            </span>

            <span
              style={{
                backgroundColor: "rgba(148, 163, 184, 0.08)",
                padding: "0.35rem 0.75rem",
                borderRadius: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              📊 {leads.length} Total
            </span>
          </div>
        </div>

        {/* Main layout: left = list + add, right = conversation */}
        <div
          className="ls-main-layout"
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "stretch",
          }}
        >
          {/* LEFT COLUMN */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            {/* HOT List */}
            <section
              style={{
                padding: "1.5rem",
                borderRadius: "1rem",
                border: "1px solid #1f2937",
              }}
            >
              <h2 style={{ marginBottom: "0.75rem" }}>Leads to Call Now (HOT)</h2>

              {loadingLeads ? (
                <p>Loading leads...</p>
              ) : leads.filter((l) => l.status === "HOT").length === 0 ? (
                <p>No HOT leads yet.</p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {leads
                    .filter((l) => l.status === "HOT")
                    .map((lead) => {
                      const isSelected = selectedLead?.id === lead.id;

                      return (
                        <li
                          key={lead.id}
                          onClick={() => handleSelectLead(lead)}
                          style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "0.75rem",
                            border: "1px solid #374151",
                            marginBottom: "0.5rem",
                            cursor: "pointer",
                            backgroundColor: isSelected
                              ? "rgba(251, 191, 36, 0.05)"
                              : "rgba(15, 23, 42, 0.6)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <strong>{lead.name || "Unnamed lead"}</strong>
                              <div
                                style={{
                                  fontSize: "0.85rem",
                                  opacity: 0.9,
                                }}
                              >
                                {lead.phone}
                              </div>
                              {lead.email && (
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    opacity: 0.8,
                                  }}
                                >
                                  {lead.email}
                                </div>
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

            {/* Add Lead */}
            <section
              style={{
                padding: "1.5rem",
                borderRadius: "1rem",
                border: "1px solid #1f2937",
              }}
            >
              <h2 style={{ marginBottom: "0.75rem" }}>Add Lead</h2>

              <form onSubmit={addLead}>
                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "0.75rem",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      color: "#f9fafb",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "0.75rem",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      color: "#f9fafb",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "0.75rem",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      color: "#f9fafb",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #374151",
                    backgroundColor: loading
                      ? "rgba(55, 65, 81, 0.6)"
                      : "rgba(37, 99, 235, 0.9)",
                    fontSize: "0.9rem",
                    cursor: loading ? "default" : "pointer",
                  }}
                >
                  {loading ? "Adding..." : "Add Lead"}
                </button>

                {message && (
                  <p
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.8rem",
                      color: "#9ca3af",
                    }}
                  >
                    {message}
                  </p>
                )}
              </form>
            </section>
          </div>

          {/* RIGHT COLUMN – Conversation */}
          <aside
            style={{
              flex: 1.2,
              borderRadius: "1rem",
              border: "1px solid #1f2937",
              padding: "1.5rem",
            }}
          >
          {/* Lead header + control */}
         <div
           style={{
             display: "flex",
             justifyContent: "space-between",
             alignItems: "flex-start",
             gap: "1rem",
             marginBottom: "0.75rem",
           }}
         >
           {/* Left: identity */}
           <div>
             <p style={{ marginBottom: "0.25rem" }}>
               <strong>{selectedLead?.name || "No lead selected"}</strong>
             </p>

             <p
               style={{
                 marginBottom: "0.25rem",
                 fontSize: "0.9rem",
               }}
             >
               📞 {selectedLead?.phone || "Select a lead from the left"}
             </p>

             <p
               style={{
                 marginBottom: "0.25rem",
                 fontSize: "0.9rem",
               }}
             >
               📧 {selectedLead?.email || ""}
             </p>

             <div>
               <span style={{ color: "#aaa", marginRight: "0.5rem" }}>
                 Status:
               </span>
               <StatusPill status={selectedLead?.status || null} />
             </div>
           </div>

           {/* Right: automation control */}
           <button
             type="button"
             onClick={() => setAutomationPaused((prev) => !prev)}
             disabled={!selectedLead}
             style={{
               fontSize: "0.75rem",
               padding: "0.35rem 0.75rem",
               borderRadius: "999px",
               border: "1px solid #374151",
               backgroundColor: automationPaused
                 ? "rgba(239, 68, 68, 0.15)" // red-ish when paused
                 : "rgba(16, 185, 129, 0.15)", // green-ish when active
               color: automationPaused ? "#fecaca" : "#6ee7b7",
               cursor: !selectedLead ? "default" : "pointer",
               opacity: !selectedLead ? 0.4 : 1,
               whiteSpace: "nowrap",
             }}
           >
             {automationPaused ? "⏸ Automation Paused" : "🟢 Automation Active"}
           </button>
         </div>

         {/* Messages list */}

            {/* Messages list / empty state */}
            <div
              style={{
                borderRadius: "0.75rem",
                border: "1px solid #444",
                padding: "0.75rem 1rem",
                maxHeight: "260px",
                overflowY: "auto",
                marginBottom: "0.75rem",
              }}
            >
              {conversation.length === 0 ? (
                // EMPTY: timeline + “now you are here” + chips
                <div
                  style={{
                    textAlign: "center",
                    padding: "2.5rem 0.5rem",
                    opacity: 0.9,
                    color: "#e5e7eb",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ padding: "0.25rem 0" }}>
                    <div style={{ marginBottom: "1rem" }}>
                      {/* Event 1 – Lead captured */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            marginRight: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              width: "0.5rem",
                              height: "0.5rem",
                              borderRadius: "999px",
                              backgroundColor: "#9ca3af",
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              width: "1px",
                              backgroundColor: "#374151",
                              marginTop: "0.15rem",
                            }}
                          />
                        </div>

                        <div style={{ textAlign: "left" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#9ca3af",
                            }}
                          >
                            {selectedLead?.created_at &&
                              new Date(
                                selectedLead.created_at as any
                              ).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                          </div>
                          <div>
                            Lead captured
                            {selectedLead?.source
                              ? ` from ${selectedLead.source}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      {/* Event 2 – Added to workflow */}
                      {selectedLead?.nurture_status && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              marginRight: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                width: "0.5rem",
                                height: "0.5rem",
                                borderRadius: "999px",
                                backgroundColor: "#9ca3af",
                              }}
                            />
                            <div
                              style={{
                                flex: 1,
                                width: "1px",
                                backgroundColor: "#374151",
                                marginTop: "0.15rem",
                              }}
                            />
                          </div>

                          <div style={{ textAlign: "left" }}>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                              }}
                            >
                              Workflow
                            </div>
                            <div>
                              Added to workflow (
                              {selectedLead.nurture_status.toLowerCase()})
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Event 3 – Scheduled next message */}
                      {selectedLead?.next_nurture_at && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              marginRight: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                width: "0.6rem",
                                height: "0.6rem",
                                borderRadius: "999px",
                                backgroundColor: "#facc15",
                              }}
                            />
                          </div>

                          <div style={{ textAlign: "left" }}>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                              }}
                            >
                              Upcoming
                            </div>
                            <div
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: 500,
                                color: "#facc15",
                              }}
                            >
                              Scheduled next message:{" "}
                              {formatShortDateTime(
                                selectedLead.next_nurture_at
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Now you are here */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                        marginTop: "1rem",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          backgroundColor: "#374151",
                        }}
                      />
                      <span style={{ padding: "0 0.5rem" }}>
                        [ Now you are here ]
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          backgroundColor: "#374151",
                        }}
                      />
                    </div>

                    <p
                      style={{
                        marginTop: "0.75rem",
                        fontSize: "0.85rem",
                      }}
                    >
                      Start the conversation by sending a message below.
                    </p>

                    {/* Quick action chips */}
                    <div
                      style={{
                        marginTop: "0.5rem",
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "999px",
                          border: "1px solid #374151",
                          backgroundColor: "rgba(55,65,81,0.4)",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setReplyText(
                            "Hi, this is [Your Name] with [Your Brokerage]. I wanted to personally introduce myself and see where you are in your plans to sell."
                          )
                        }
                      >
                        👋 Send Intro
                      </button>

                      <button
                        type="button"
                        style={{
                          padding: "0.35rem 0.75rem",
                          borderRadius: "999px",
                          border: "1px solid #374151",
                          backgroundColor: "rgba(55,65,81,0.4)",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setReplyText(
                            "Do you have 10–15 minutes this week for a quick call so I can give you a pricing + timing game plan for your home?"
                          )
                        }
                      >
                        📅 Book Call
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // NON-EMPTY: show actual messages
                <div style={{ padding: "0.25rem 0" }}>
                  {conversation.map((msg: MessageRow) => {
                    const isInbound = msg.direction === "INBOUND";

                    return (
                      <div
                        key={msg.id}
                        style={{
                          marginBottom: "0.75rem",
                          textAlign: isInbound ? "left" : "right",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                            marginBottom: "0.15rem",
                          }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}
                        </div>

                        <div
                          style={{
                            display: "inline-block",
                            padding: "0.35rem 0.6rem",
                            borderRadius: "0.5rem",
                            backgroundColor: isInbound
                              ? "#111827"
                              : "#1f2937",
                            border: "1px solid #374151",
                            fontSize: "0.85rem",
                          }}
                        >
                          {msg.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reply form */}
            <div>
              <form
                onSubmit={handleSendReply}
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginTop: "0.5rem",
                }}
              >
                <input
                  type="text"
                  placeholder="Type a reply to this lead..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "0.6rem 0.75rem",
                    borderRadius: "999px",
                    border: "1px solid #374151",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "#f9fafb",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  type="submit"
                  disabled={!selectedLead || sendingReply || !replyText.trim()}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "999px",
                    border: "1px solid #374151",
                    backgroundColor: sendingReply
                      ? "rgba(55,65,81,0.7)"
                      : "rgba(59,130,246,0.9)",
                    fontSize: "0.9rem",
                    opacity:
                      !selectedLead || sendingReply || !replyText.trim()
                        ? 0.5
                        : 1,
                    cursor:
                      !selectedLead || sendingReply || !replyText.trim()
                        ? "default"
                        : "pointer",
                  }}
                >
                  {sendingReply ? "Sending…" : "Send"}
                </button>
              </form>

              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#555",
                  margin: 0,
                  marginTop: "0.25rem",
                }}
              >
                Replies here send an SMS to this lead and are logged in the
                conversation above.
              </p>
            </div>
          </aside>
        </div>

        {/* Responsive layout rules */}
        <style jsx>{`
          .ls-main-layout {
            flex-direction: row;
          }

          @media (max-width: 900px) {
            .ls-main-layout {
              flex-direction: column;
            }
          }
        `}</style>
      </main>
    </>
  );
}
