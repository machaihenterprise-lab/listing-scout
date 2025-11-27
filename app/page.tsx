'use client';

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";

type Lead = {
  id: string;
  created_at?: string | null;
  name: string;
  phone: string;
  email: string;
  source: string | null;
  status: string | null;

  nurture_status?: string | null;
  nurture_stage?: string | null;
  next_nurture_at?: string | null;
  last_nurture_sent_at?: string | null;
  last_agent_sent_at?: string | null;
  nurture_locked_until?: string | null;

  lastContactedAt?: string | null; // mapped from last_contacted_at
};

type MessageRow = {
  id: string;
  lead_id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: string | null;
  body: string;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Header + small helpers                                             */
/* ------------------------------------------------------------------ */

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
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Listing Scout</h2>

      <nav className="hidden lg:flex" style={{ gap: "1.5rem" }}>
        <a href="#" style={{ opacity: 0.8 }}>
          Leads
        </a>
        <a href="#" style={{ opacity: 0.8 }}>
          Settings
        </a>
        <a href="#" style={{ opacity: 0.8 }}>
          Account
        </a>
      </nav>

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
      <span
        className={`${base} bg-red-500/15 text-red-400 border border-red-500/30`}
      >
        🔥 HOT
      </span>
    );
  }

  if (normalized === "NURTURE") {
    return (
      <span
        className={`${base} bg-emerald-500/10 text-emerald-300 border border-emerald-500/20`}
      >
        🌱 Nurture
      </span>
    );
  }

  return (
    <span
      className={`${base} bg-slate-500/10 text-slate-300 border border-slate-500/20`}
    >
      {normalized || "UNKNOWN"}
    </span>
  );
}

function formatShortDateTime(dateString: string | null | undefined) {
  if (!dateString) return "";
  const d = new Date(dateString);

  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} at ${timePart}`;
}

/* ------------------------------------------------------------------ */
/* Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  // Lead form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Lead + UI state
  const [loading, setLoading] = useState(false); // add-lead form
  const [message, setMessage] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Conversation + reply box
  const [conversation, setConversation] = useState<MessageRow[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Twilio test
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  // Pause automation toggle
  const [automationPaused, setAutomationPaused] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Data access helpers                                                */
  /* ------------------------------------------------------------------ */

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error when loading leads:", error);
        setMessage(
          `Error loading leads: ${error.message || "Unknown error"}`
        );
        setLeads([]);
        return;
      }

      if (!data) {
        setLeads([]);
        return;
      }

      const mappedLeads: Lead[] = data.map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
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

        lastContactedAt: row.last_contacted_at ?? null,
      }));

      setLeads(mappedLeads);

      // Auto-select a lead if none selected yet
      if (!selectedLead && mappedLeads.length > 0) {
        const firstHot =
          mappedLeads.find((l) => l.status === "HOT") || mappedLeads[0];
        setSelectedLead(firstHot);
      }
    } catch (err: any) {
      console.error("Error loading leads:", err);
      setMessage(
        `Error loading leads: ${err.message || "Unknown error"}`
      );
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [selectedLead]);

  const fetchMessages = useCallback(
    async (leadId: string) => {
      if (!leadId) return;

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        setMessage(`Error loading messages: ${error.message}`);
        return;
      }

      setConversation((data || []) as MessageRow[]);
    },
    []
  );

  /* ------------------------------------------------------------------ */
  /* Actions                                                            */
  /* ------------------------------------------------------------------ */

  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    setMessage(null);
    // messages + polling are handled by the effect below; this call
    // gives you a snappier initial load when switching leads:
    await fetchMessages(lead.id);
  };

  const handleSendReply = async () => {
    if (!selectedLead) {
      setMessage("Please select a lead first.");
      return;
    }

    const trimmed = replyText.trim();
    if (!trimmed) return;

    try {
      setSendingReply(true);
      setMessage(null);

      const res = await fetch("/api/reply-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          to: selectedLead.phone,
          body: trimmed,
        }),
      });

      // Update last_contacted_at
      await supabase
        .from("leads")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", selectedLead.id);

      // Refresh leads so UI reflects updated last-contacted info
      await fetchLeads();

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        console.error("reply-sms API returned error", res.status, data);
        setMessage(
          data?.error ||
            `Error sending reply (status ${res.status}). Check server logs.`
        );
        return;
      }

      // ✅ Local echo so the message shows instantly
    const nowIso = new Date().toISOString();
    setConversation((prev) => [
      ...prev,
      {
        id: `local-${nowIso}`, // temporary local id
        lead_id: selectedLead.id,
        direction: "OUTBOUND",
        channel: "sms",
        body: trimmed,
        created_at: nowIso,
      } as MessageRow,
    ]);

      setReplyText("");

     // Optional: you can keep this if you want to resync from DB;
     // if you start seeing duplicates, comment it out and rely on polling.
     // await fetchMessages(selectedLead.id);

      await fetchMessages(selectedLead.id);
    } catch (err: any) {
      console.error("Error sending reply:", err);
      setMessage(err?.message || "Error sending reply");
    } finally {
      setSendingReply(false);
    }
  };

  const addLead = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setMessage(null);

  console.log("[addLead] submitting", { name, phone, email });

  try {
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name,
        phone,
        email,
        source: "manual",
        status: "NURTURE",
        nurture_status: "ACTIVE",
        nurture_stage: "DAY_1",
        next_nurture_at: new Date().toISOString(),
      })
      .select(); // ask Supabase to return the row so we know it worked

    console.log("[addLead] Supabase response", { data, error });

    if (error) {
      // This is the IMPORTANT part — show the actual supabase error
      setMessage(`Supabase insert error: ${error.message}`);
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setMessage("Lead added successfully.");

    await fetchLeads();
  } catch (err: any) {
    console.error("[addLead] Network / unknown error", err);
    // This is where "TypeError: Failed to fetch" will show if it’s truly network
    setMessage(
      `Network or unknown error adding lead: ${
        err?.message || "Unknown error"
      }`
    );
  } finally {
    setLoading(false);
  }
};


  const sendTestSms = async () => {
    try {
      setSmsLoading(true);
      setSmsMessage(null);

      const res = await fetch("/api/test-sms", {
        method: "POST",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || "Failed to send SMS");
      }

      setSmsMessage("Test SMS sent!");
    } catch (err: any) {
      console.error(err);
      setSmsMessage(err.message || "Error sending test SMS");
    } finally {
      setSmsLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Effects                                                            */
  /* ------------------------------------------------------------------ */

  // Load leads once on first render
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // When selected lead changes, un-pause automation
  useEffect(() => {
    if (!selectedLead?.id) return;
    setAutomationPaused(false);
  }, [selectedLead?.id]);

  // When a lead is selected:
  // - load messages immediately
  // - start polling every 5 seconds
  // - stop polling when lead changes or component unmounts
  useEffect(() => {
    if (!selectedLead?.id) return;

    // Initial load
    fetchMessages(selectedLead.id);

    const intervalId = window.setInterval(() => {
      fetchMessages(selectedLead.id);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedLead?.id, fetchMessages]);

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

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

        {/* Main layout */}
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
               padding: "1rem 1.5rem 1.5rem", // less top padding
               display: "flex",
               flexDirection: "column",
             }}
            >

            {/* Lead header */}
            <p style={{ marginBottom: "0.25rem" }}>
              <strong>{selectedLead?.name || "No lead selected"}</strong>
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <span style={{ color: "#aaa", marginRight: "0.5rem" }}>
                Status:
              </span>
              <StatusPill status={selectedLead?.status || null} />
            </div>

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
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
                color: automationPaused ? "#fecaca" : "#6ee7b7",
                cursor: !selectedLead ? "default" : "pointer",
                opacity: !selectedLead ? 0.4 : 1,
                marginBottom: "0.75rem",
              }}
            >
              {automationPaused ? "⏸ Automation Paused" : "🟢 Automation Active"}
            </button>

            <div
  style={{
    borderRadius: "0.75rem",
    border: "1px solid #444",
    padding: "0.75rem 1rem",
    maxHeight: "260px",
    overflowY: "auto",
    marginBottom: "0.5rem", // was 0.75rem
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
                  {formatShortDateTime(selectedLead.next_nurture_at)}
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
              {new Date(msg.created_at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>

            <div
              style={{
                display: "inline-block",
                padding: "0.35rem 0.6rem",
                borderRadius: "0.5rem",
                backgroundColor: isInbound ? "#111827" : "#1f2937",
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
            {/* --- END conversation block --- */}

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
                  disabled={
                    !selectedLead || sendingReply || !replyText.trim()
                  }
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

            {/* Optional: Test SMS button + status */}
            <div style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
              <button
                type="button"
                onClick={sendTestSms}
                disabled={smsLoading}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid #374151",
                  backgroundColor: "rgba(37, 99, 235, 0.9)",
                  fontSize: "0.8rem",
                  cursor: smsLoading ? "default" : "pointer",
                  opacity: smsLoading ? 0.6 : 1,
                }}
              >
                {smsLoading ? "Sending SMS…" : "Send SMS"}
              </button>
              {smsMessage && (
                <span style={{ marginLeft: "0.5rem", color: "#9ca3af" }}>
                  {smsMessage}
                </span>
              )}
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
