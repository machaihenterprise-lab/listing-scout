"use client";

import React, {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
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
  has_unread_messages?: boolean | null;
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

type HeaderProps = {
  onHeightChange?: (h: number) => void;
};

function Header({ onHeightChange }: HeaderProps) {
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Prefer ResizeObserver when available
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        onHeightChange?.(el.offsetHeight);
      });
      ro.observe(el);
      // initial
      onHeightChange?.(el.offsetHeight);
      return () => ro.disconnect();
    }

    const measure = () => onHeightChange?.(el.offsetHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [onHeightChange]);

  return (
    <header
      ref={elRef as React.RefObject<HTMLElement>}
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

  // SMS provider tests removed — using Telnyx for inbound/outbound

  // Pause automation toggle
  const [automationPaused, setAutomationPaused] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);

  // Left column UI: search, filter, modal
  const [searchTerm, setSearchTerm] = useState("");
  const [leadFilter, setLeadFilter] = useState<"HOT" | "NURTURE" | "ALL">("NURTURE");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddNameRef = useRef<HTMLInputElement | null>(null);
  const modalNameRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Snooze UI state
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeCustomDate, setSnoozeCustomDate] = useState<string>("");
  const [snoozeLoading, setSnoozeLoading] = useState(false);
  const snoozeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [snoozePopoverPos, setSnoozePopoverPos] = useState<{ left: number; top: number } | null>(null);

  // Undo toast state after snooze
  const [undoPayload, setUndoPayload] = useState<null | { leadId: string; prevStatus: string | null }>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  // Header height provided by `Header` via `onHeightChange` (not used yet)

  // Activity summary (While you were sleeping)
  const [activity, setActivity] = useState<null | { nurtureTexts: number; newLeads: number; errors: number }>(null);
  const [activityUpdatedAt, setActivityUpdatedAt] = useState<string | null>(null);
  const hasActivity = !!activity && ((activity.nurtureTexts || 0) > 0 || (activity.newLeads || 0) > 0 || (activity.errors || 0) > 0);

  // Right column tab state (conversation vs notes)
  const [rightTab] = useState<'conversation' | 'notes'>('conversation');

  // Mobile master/detail control: when a lead is selected we treat that
  // as the "detail" view on small screens.
  const isDetailViewOpen = !!selectedLead;
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setIsMobile(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(update);
    }
    return () => {
      if (typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', update);
      } else if (typeof mq.removeListener === 'function') {
        mq.removeListener(update);
      }
    };
  }, []);

  // Scroll behavior controls
  const SCROLL_THRESHOLD_PX = 150; // distance from bottom to consider "near bottom"
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [autoScrollAlways, setAutoScrollAlways] = useState(false);

  const scrollToBottom = useCallback((force = false) => {
    const el = messagesEndRef.current;
    if (!el) return;

    // If not forcing and user is scrolled up and auto-scroll is not always-on, bail
    if (!force && isScrolledUp && !autoScrollAlways) return;

    try {
      (el as HTMLDivElement).scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, [isScrolledUp, autoScrollAlways]);

  // Load persisted preference for auto-scroll mode (localStorage)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ls:autoScrollAlways");
      if (raw !== null) {
        setAutoScrollAlways(raw === "1");
      }
    } catch {
      // ignore (SSR or privacy settings)
    }
  }, []);

  // Persist preference when it changes
  useEffect(() => {
    try {
      localStorage.setItem("ls:autoScrollAlways", autoScrollAlways ? "1" : "0");
    } catch {
      // ignore
    }
  }, [autoScrollAlways]);

  /* ------------------------------------------------------------------ */
  /* Data access helpers                                                */
  /* ------------------------------------------------------------------ */

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase!
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

      const mappedLeads: Lead[] = (data as Array<Record<string, unknown>>).map((row) => {
        const r = row as Partial<Lead>;
        return {
          id: (r.id as string) || "",
          created_at: (r.created_at as string) ?? null,
          name: (r.name as string) || "",
          phone: (r.phone as string) || "",
          email: (r.email as string) || "",
          source: (r.source as string) ?? null,
          status: (r.status as string) ?? null,

          nurture_status: (r.nurture_status as string) ?? null,
          nurture_stage: (r.nurture_stage as string) ?? null,
          next_nurture_at: (r.next_nurture_at as string) ?? null,
          last_nurture_sent_at: (r.last_nurture_sent_at as string) ?? null,
          last_agent_sent_at: (r.last_agent_sent_at as string) ?? null,
          nurture_locked_until: (r.nurture_locked_until as string) ?? null,

          lastContactedAt: ((r as Record<string, unknown>)['last_contacted_at'] as string) ?? null,
          has_unread_messages: (r.has_unread_messages as boolean) ?? false,
        } as Lead;
      });

      setLeads(mappedLeads);

      // Auto-select a lead if none selected yet. Prefer a lead matching the
      // current `leadFilter` so newly-created leads are immediately visible.
      if (!selectedLead && mappedLeads.length > 0) {
        const preferred =
          mappedLeads.find((l) => (leadFilter === 'ALL' ? true : l.status === leadFilter)) || mappedLeads[0];
        setSelectedLead(preferred);
      }
    } catch (err: unknown) {
      console.error("Error loading leads:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(`Error loading leads: ${msg || "Unknown error"}`);
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [selectedLead, leadFilter]);

  const fetchMessages = useCallback(
  async (leadId: string) => {
    console.log("[fetchMessages] for lead", leadId);

    // Query messages for the specific lead only so the conversation pane
    // shows messages belonging to the selected lead (filter by lead_id).
    const { data, error } = await supabase!
      .from("messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    console.log("[fetchMessages] result", { error, data });

    if (error) {
      console.error("Error loading messages:", error);
      setMessage(`Error loading messages: ${error.message}`);
      return;
    }

    setConversation((data || []) as MessageRow[]);

    // After messages render, schedule a double requestAnimationFrame to ensure
    // layout is settled before scrolling. Use a direct scroll here to avoid
    // adding `scrollToBottom` to the callback deps.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = messagesEndRef.current;
        if (!el) return;
        try {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } catch {
          el.scrollTop = el.scrollHeight;
        }
      }),
    );
  },
  []
);

  // Snooze handlers
  const handleSnooze = async (targetDate: Date) => {
    if (!selectedLead) return;
    setSnoozeLoading(true);
    const prevStatus = selectedLead.status ?? null;
    try {
      const iso = targetDate.toISOString();
      const { error } = await supabase!
        .from("leads")
        .update({ nurture_locked_until: iso, nurture_status: "SNOOZED" })
        .eq("id", selectedLead.id)
        .select();

      if (error) {
        console.error("Snooze update error:", error);
        setMessage(`Error snoozing lead: ${error.message}`);
        return;
      }

      setMessage("Lead snoozed.");
      // Refresh leads and clear selection (lead disappears)
      await fetchLeads();
      setSelectedLead(null);
      // Setup undo payload + toast
      setUndoPayload({ leadId: selectedLead.id, prevStatus });
      // animate toast in
      setUndoVisible(true);
      // auto-hide after 6s (and clear payload after animation finishes)
      window.setTimeout(() => {
        setUndoVisible(false);
        // give animation 250ms to finish then clear the payload
        window.setTimeout(() => setUndoPayload(null), 300);
      }, 6000);
      setSnoozeOpen(false);
    } catch (err: unknown) {
      console.error("Error snoozing lead:", err);
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSnoozeLoading(false);
    }
  };

  const handleSnoozePreset = (days: number) => {
    const now = new Date();
    const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    // set time to 09:00 local for convenience
    target.setHours(9, 0, 0, 0);
    handleSnooze(target);
  };

  const handleSnoozeCustom = async () => {
    if (!snoozeCustomDate) return;
    const d = new Date(snoozeCustomDate);
    d.setHours(9, 0, 0, 0);
    await handleSnooze(d);
  };

  const handleUndoSnooze = async () => {
    if (!undoPayload) return;
    try {
      const { leadId, prevStatus } = undoPayload;
      await supabase!.from("leads").update({ nurture_locked_until: null, nurture_status: prevStatus ?? "NURTURE" }).eq("id", leadId);
      setMessage("Snooze undone.");
      await fetchLeads();
      setUndoVisible(false);
      setUndoPayload(null);
    } catch (err: unknown) {
      console.error("Error undoing snooze:", err);
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

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
    await supabase!
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString() })
      .eq("id", selectedLead.id);

    // Refresh leads so "Last contacted" etc stay in sync
    await fetchLeads();

    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      console.error("reply-sms API returned error", res.status, data);
      const apiError =
        data && typeof data === "object" && "error" in data && typeof (data as Record<string, unknown>)["error"] === "string"
          ? ((data as Record<string, unknown>)["error"] as string)
          : undefined;
      setMessage(apiError || `Error sending reply (status ${res.status}). Check server logs.`);
      return;
    }

    // ✅ LOCAL ECHO: show the new message immediately in the UI
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

    // After local echo, immediately scroll so the user's message is visible
    // Use double rAF to ensure DOM update has applied
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom(true)));

    // Clear input
    setReplyText("");

    // ❌ IMPORTANT: DO NOT call fetchMessages here.
    // The 5s polling effect will pick up the DB row when it exists.
    // If we call fetchMessages immediately and the DB isn’t updated yet,
    // we wipe out the locally-added message.
  } catch (err: unknown) {
    console.error("Error sending reply:", err);
    const msg = err instanceof Error ? err.message : String(err);
    setMessage(msg || "Error sending reply");
  } finally {
    setSendingReply(false);
  }
};

  // Ghost variable preview: replace known placeholders like {first_name}
  // with data from the selected lead so agents can confirm before sending.
  const generatePreview = (text: string) => {
    if (!text) return "";
    // simple variable replacement
    return text.replace(/\{(\w+)\}/g, (match, varName) => {
      if (!selectedLead) return match;

      switch (varName.toLowerCase()) {
        case "first_name": {
          const name = selectedLead.name || "";
          const first = name.split(" ").filter(Boolean)[0] || name || "";
          return first || "[first name]";
        }
        case "full_name":
        case "name":
          return selectedLead.name || "[name]";
        case "phone":
          return selectedLead.phone || "[phone]";
        default:
          // unknown variable: leave as-is so agent notices it
          return match;
      }
    });
  };

  // Perform the automation toggle (updates DB + UI)
  const performToggleAutomation = async (willPause: boolean) => {
    if (!selectedLead) return;

    const newStatus = willPause ? "PAUSED" : "ACTIVE";
    // optimistic
    setAutomationPaused(willPause);
    setShowPauseConfirm(false);
    setMessage(null);

    try {
      const { error } = await supabase!
        .from("leads")
        .update({ nurture_status: newStatus })
        .eq("id", selectedLead.id);

      if (error) {
        console.error("Error updating nurture_status:", error);
        setMessage(`Error updating automation: ${error.message || "Unknown"}`);
        setAutomationPaused(!willPause);
        return;
      }

      await fetchLeads();
      setSelectedLead({ ...selectedLead, nurture_status: newStatus });
      setMessage(willPause ? "Automation paused." : "Automation activated.");
    } catch (err: unknown) {
      console.error("Error toggling automation:", err);
      setMessage(err instanceof Error ? err.message : String(err));
      setAutomationPaused(!willPause);
    }
  };

  // Click handler: if pausing, show confirmation; if activating, run immediately.
  const handleToggleAutomation = () => {
    if (!selectedLead) {
      setMessage("Select a lead to change automation status.");
      return;
    }

    const willPause = !automationPaused;
    if (willPause) {
      setShowPauseConfirm(true);
      return;
    }

    // activating automation — do it immediately
    void performToggleAutomation(false);
  };

  const addLead = async (e?: FormEvent) => {
  if (e) e.preventDefault();
  setLoading(true);
  setMessage(null);

  console.log("[addLead] submitting", { name, phone, email });

    try {
    const { data, error } = await supabase!
      .from("leads")
      .insert({
        name,
        phone,
        email,
        source: "manual",
        // Default new manual leads to NURTURE so they enter the nurture workflow
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

    // Attempt to map the returned row and auto-select it
    const inserted = Array.isArray(data) && data.length > 0 ? (data[0] as Record<string, unknown>) : null;

    const newLead: Lead | null = inserted
      ? {
          id: (inserted.id as string) || "",
          created_at: (inserted.created_at as string) ?? null,
          name: (inserted.name as string) || "",
          phone: (inserted.phone as string) || "",
          email: (inserted.email as string) || "",
          source: (inserted.source as string) ?? null,
          status: (inserted.status as string) ?? null,
          nurture_status: (inserted.nurture_status as string) ?? null,
          nurture_stage: (inserted.nurture_stage as string) ?? null,
          next_nurture_at: (inserted.next_nurture_at as string) ?? null,
          last_nurture_sent_at: (inserted.last_nurture_sent_at as string) ?? null,
          last_agent_sent_at: (inserted.last_agent_sent_at as string) ?? null,
          nurture_locked_until: (inserted.nurture_locked_until as string) ?? null,
          lastContactedAt: (inserted['last_contacted_at'] as string) ?? null,
        }
      : null;

    setName("");
    setPhone("");
    setEmail("");
    setMessage("Lead added successfully.");

    // Refresh leads list and auto-select the newly created lead if available
    await fetchLeads();
    if (newLead) {
      setSelectedLead(newLead);
      try {
        await fetchMessages(newLead.id);
      } catch {
        // ignore fetchMessages errors — polling will pick up messages
      }
    }

    // Close modal if open
    setAddModalOpen(false);
    return true;
  } catch (err: unknown) {
    console.error("[addLead] Network / unknown error", err);
    // This is where "TypeError: Failed to fetch" will show if it’s truly network
    const msg = err instanceof Error ? err.message : String(err);
    setMessage(`Network or unknown error adding lead: ${msg || "Unknown error"}`);
  } finally {
    setLoading(false);
  }
  return false;
};


  // sendTestSms removed — test button UI removed from the conversation pane.

  /* ------------------------------------------------------------------ */
  /* Effects                                                            */
  /* ------------------------------------------------------------------ */

  // Activity polling helper: fetch counts since `ls:lastSeen` (fallback 24h)
  const fetchActivity = useCallback(async () => {
    try {
      const lastSeen = (() => {
        try {
          const s = localStorage.getItem('ls:lastSeen');
          if (s) return s;
        } catch {}
        return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      })();

      const res = await fetch('/api/activity-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSeen }),
      });

      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json && json.ok && json.counts) {
        setActivity({ nurtureTexts: json.counts.nurtureTexts || 0, newLeads: json.counts.newLeads || 0, errors: json.counts.errors || 0 });
        setActivityUpdatedAt(new Date().toISOString());
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  // Load leads once on first render and start activity polling.
  useEffect(() => {
    fetchLeads();
    // initial fetch
    fetchActivity();

    // Poll every 5 minutes so the activity card stays up-to-date.
    const POLL_MS = 5 * 60 * 1000;
    const id = window.setInterval(() => {
      fetchActivity();
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, [fetchLeads, fetchActivity]);

  // When selected lead changes, un-pause automation
  useEffect(() => {
    if (!selectedLead?.id) return;
    // Derive paused state from lead.nurture_status so UI reflects DB
    setAutomationPaused((selectedLead.nurture_status || "").toUpperCase() === "PAUSED");
  }, [selectedLead?.id, selectedLead?.nurture_status]);

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

  // Observe scroll position to know whether the user is scrolled up
  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsScrolledUp(distanceFromBottom > SCROLL_THRESHOLD_PX);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // initialize
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
     
  }, []);

  // Auto-scroll chat container to bottom whenever conversation updates
  useEffect(() => {
    // Use the central helper which obeys `isScrolledUp` and `autoScrollAlways`.
    // Run in rAF to ensure DOM layout is ready.
    requestAnimationFrame(() => {
      scrollToBottom(false);
    });
  }, [conversation, scrollToBottom]);

  // Focus the Quick Add name input when the quick-add panel opens
  useEffect(() => {
    if (!quickAddOpen) return;
    requestAnimationFrame(() => {
      quickAddNameRef.current?.focus();
    });
  }, [quickAddOpen]);

  // Focus the modal name input when the Add Lead modal opens
  useEffect(() => {
    if (!addModalOpen) return;
    requestAnimationFrame(() => {
      modalNameRef.current?.focus();
    });
  }, [addModalOpen]);

  // Ensure any prior status/message is cleared when either add UI opens
  useEffect(() => {
    if (quickAddOpen || addModalOpen) {
      setMessage(null);
    }
  }, [quickAddOpen, addModalOpen]);

  // Lead filtering + search for the left column
  const filteredLeads = leads
    .filter((l) => {
      // Exclude actively snoozed leads (nurture_locked_until in future)
      if (l.nurture_locked_until) {
        const locked = new Date(l.nurture_locked_until);
        if (locked.getTime() > Date.now()) return false;
      }

      // Filter by tab
      if (leadFilter === "HOT" && l.status !== "HOT") return false;
      if (leadFilter === "NURTURE" && l.status !== "NURTURE") return false;

      // Search by name / phone / email
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        (l.name || "").toLowerCase().includes(s) ||
        (l.phone || "").toLowerCase().includes(s) ||
        (l.email || "").toLowerCase().includes(s)
      );
    })
    // Bring recently-expired snoozes to the top
    .sort((a, b) => {
      const aExpired = !!a.nurture_locked_until && new Date(a.nurture_locked_until).getTime() <= Date.now() && a.nurture_status === "SNOOZED";
      const bExpired = !!b.nurture_locked_until && new Date(b.nurture_locked_until).getTime() <= Date.now() && b.nurture_status === "SNOOZED";
      if (aExpired && !bExpired) return -1;
      if (!aExpired && bExpired) return 1;
      // fallback to created_at desc
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });

  // Snooze badges counts
  const snoozedCount = leads.filter((l) => l.nurture_locked_until && new Date(l.nurture_locked_until).getTime() > Date.now()).length;
  const expiredSnoozeCount = leads.filter((l) => l.nurture_locked_until && new Date(l.nurture_locked_until).getTime() <= Date.now() && l.nurture_status === "SNOOZED").length;

  // Modal submit helper
  const handleModalSubmit = async (e: FormEvent) => {
    const ok = await addLead(e);
    if (ok) {
      setAddModalOpen(false);
    }
  };

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
        {/* Title + stats + snooze control */}
        <div style={{ marginBottom: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
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
                {(snoozedCount > 0 || expiredSnoozeCount > 0) && (
                  <span style={{ marginLeft: "0.35rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "999px", backgroundColor: expiredSnoozeCount > 0 ? "#f59e0b" : "#3b82f6", color: "#fff" }}>
                      {expiredSnoozeCount > 0 ? `${expiredSnoozeCount}⚠` : `${snoozedCount}`}
                    </span>
                  </span>
                )}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              ref={snoozeButtonRef}
              type="button"
              onClick={() => {
                // compute popover position relative to button
                if (snoozeButtonRef.current) {
                  const rect = snoozeButtonRef.current.getBoundingClientRect();
                  const popWidth = 260;
                  // If popover would overflow the right edge, anchor to the button's left
                  let left = rect.right - popWidth;
                  if (rect.right + 16 > window.innerWidth) {
                    left = rect.left;
                  }
                  left = Math.max(8, left + window.scrollX);
                  const top = rect.bottom + 8 + window.scrollY;
                  setSnoozePopoverPos({ left, top });
                }
                setSnoozeOpen((v) => !v);
              }}
              disabled={!selectedLead}
              title={selectedLead ? "Snooze selected lead" : "Select a lead to snooze"}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "0.6rem",
                border: "1px solid #374151",
                backgroundColor: !selectedLead ? "transparent" : "rgba(37,99,235,0.9)",
                color: !selectedLead ? "#6b7280" : "#fff",
                cursor: !selectedLead ? "default" : "pointer",
              }}
            >
              ⏰ Snooze
            </button>
          </div>
        </div>

        {/* Activity summary ticker: shows what the bot did since lastSeen. */}
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: '#071025', border: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {hasActivity ? (
                  <span aria-hidden className="ls-activity-badge" />
                ) : null}

                <div style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>
                  {activity ? (
                    <div>
                      <div>
                        Since your last login: <strong style={{ color: '#93c5fd' }}>{activity.nurtureTexts}</strong> Nurture Texts Sent, <strong style={{ color: '#86efac' }}>{activity.newLeads}</strong> New Leads, <strong style={{ color: activity.errors > 0 ? '#fb7185' : '#94a3b8' }}>{activity.errors}</strong> Errors.
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        Last updated: {activityUpdatedAt ? formatShortDateTime(activityUpdatedAt) : '—'}
                      </div>
                    </div>
                  ) : (
                    <span>Loading activity summary…</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem('ls:lastSeen', new Date().toISOString());
                    } catch {}
                    // re-fetch activity immediately so the UI clears
                    try {
                      fetchActivity();
                      setActivityUpdatedAt(new Date().toISOString());
                    } catch {}
                  }}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #374151', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
                >
                  Mark read
                </button>
              </div>
            </div>
        </div>

        {/* Main layout: stacked on mobile, side-by-side on md+ */}
        <div
          className={`ls-main-layout h-screen flex flex-col md:flex-row ${isDetailViewOpen ? 'detail-open' : ''}`}
          style={{
            gap: "1.5rem",
            alignItems: "stretch",
          }}
        >
          {/* Snooze popover (anchored top-right) */}
          {snoozeOpen && (
            <div
              role="dialog"
              aria-modal="false"
              style={{
                position: "absolute",
                left: snoozePopoverPos ? `${snoozePopoverPos.left}px` : undefined,
                top: snoozePopoverPos ? `${snoozePopoverPos.top}px` : undefined,
                right: snoozePopoverPos ? undefined : "1rem",
                zIndex: 300,
                background: "#071023",
                border: "1px solid #374151",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                width: "260px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Snooze lead</div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <button type="button" onClick={() => handleSnoozePreset(1)} style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(55,65,81,0.6)", color: "#fff", border: "1px solid #374151" }}>
                  Tomorrow
                </button>
                <button type="button" onClick={() => handleSnoozePreset(3)} style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(55,65,81,0.6)", color: "#fff", border: "1px solid #374151" }}>
                  3 days
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <button type="button" onClick={() => handleSnoozePreset(7)} style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "rgba(55,65,81,0.6)", color: "#fff", border: "1px solid #374151" }}>
                  Next week
                </button>
                <button type="button" onClick={() => { setSnoozeCustomDate(""); }} style={{ flex: 1, padding: "0.4rem", borderRadius: "0.4rem", background: "transparent", color: "#9ca3af", border: "1px solid #374151" }}>
                  Custom
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <input type="date" value={snoozeCustomDate} onChange={(e) => setSnoozeCustomDate(e.target.value)} style={{ flex: 1, padding: "0.35rem", borderRadius: "0.4rem", border: "1px solid #374151", background: "rgba(15,23,42,0.9)", color: "#f9fafb" }} />
                <button type="button" onClick={handleSnoozeCustom} disabled={snoozeLoading || !snoozeCustomDate} style={{ padding: "0.4rem", borderRadius: "0.4rem", background: snoozeLoading ? "rgba(55,65,81,0.6)" : "rgba(37,99,235,0.9)", color: "#fff", border: "1px solid #374151" }}>
                  Snooze
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" onClick={() => setSnoozeOpen(false)} style={{ padding: "0.35rem 0.5rem", borderRadius: "0.4rem", background: "transparent", color: "#9ca3af", border: "1px solid #374151" }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Undo toast */}
          {undoPayload && (
            <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 400 }}>
              <div
                aria-live="polite"
                style={{
                  background: '#0b1220',
                  color: '#fff',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #374151',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  // transition for subtle slide/fade
                  transition: 'opacity 220ms ease, transform 220ms ease',
                  opacity: undoVisible ? 1 : 0,
                  transform: undoVisible ? 'translateY(0)' : 'translateY(12px)',
                }}
              >
                <div>Lead snoozed</div>
                <button onClick={handleUndoSnooze} style={{ padding: '0.35rem 0.55rem', borderRadius: '0.4rem', background: 'rgba(59,130,246,0.9)', color: '#fff', border: '1px solid #374151' }}>Undo</button>
              </div>
            </div>
          )}
          {/* LEFT COLUMN: Search + Filters + Lead list */}
          {!(isMobile && isDetailViewOpen) && (
            <div
              className={`h-full ${isDetailViewOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
              style={{
                flex: 1,
                gap: "1rem",
                height: '100%'
              }}
            >
            {/* Search + Tabs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search leads by name, phone, or email"
                className="w-full"
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #374151",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "#f9fafb",
                }}
              />

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setLeadFilter("HOT")}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "999px",
                    border: leadFilter === "HOT" ? "1px solid #f59e0b" : "1px solid #374151",
                    backgroundColor: leadFilter === "HOT" ? "rgba(245,158,11,0.08)" : "transparent",
                    color: leadFilter === "HOT" ? "#fbbf24" : "#9ca3af",
                    cursor: "pointer",
                  }}
                >
                  🔥 Hot
                </button>

                <button
                  type="button"
                  onClick={() => setLeadFilter("NURTURE")}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "999px",
                    border: leadFilter === "NURTURE" ? "1px solid #10b981" : "1px solid #374151",
                    backgroundColor: leadFilter === "NURTURE" ? "rgba(16,185,129,0.06)" : "transparent",
                    color: leadFilter === "NURTURE" ? "#6ee7b7" : "#9ca3af",
                    cursor: "pointer",
                  }}
                >
                  🌱 Nurture
                </button>

                <button
                  type="button"
                  onClick={() => setLeadFilter("ALL")}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "999px",
                    border: leadFilter === "ALL" ? "1px solid #94a3b8" : "1px solid #374151",
                    backgroundColor: leadFilter === "ALL" ? "rgba(148,163,184,0.06)" : "transparent",
                    color: leadFilter === "ALL" ? "#cbd5e1" : "#9ca3af",
                    cursor: "pointer",
                  }}
                >
                  All
                </button>
              </div>
            </div>

            {/* Lead list (scrollable) */}
            <section
              className="h-full overflow-y-auto ls-lead-list"
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "1rem",
                border: "1px solid #1f2937",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {loadingLeads ? (
                <p>Loading leads...</p>
              ) : filteredLeads.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>No leads match your filters.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    return (
                      <li
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        style={{
                          padding: "0.75rem 1rem",
                          borderRadius: "0.75rem",
                          marginBottom: "0.5rem",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          // When selected, use a slightly lighter gray and add
                          // a yellow accent bar on the left to visually anchor
                          // the selected lead to the conversation on the right.
                          backgroundColor: isSelected ? "#1f2937" : "rgba(15,23,42,0.6)",
                          border: isSelected ? "1px solid rgba(255,255,255,0.03)" : "1px solid #374151",
                          borderLeft: isSelected ? "4px solid #f59e0b" : undefined,
                          transition: "background-color 140ms ease, border-left-color 140ms ease",
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {lead.has_unread_messages ? (
                              <span
                                aria-hidden
                                title="Unread messages"
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '999px',
                                  backgroundColor: '#ef4444', // red unread dot
                                  display: 'inline-block',
                                }}
                              />
                            ) : null}

                            <strong>{lead.name || "Unnamed lead"}</strong>
                          </div>

                          <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>{lead.phone}</div>
                          {lead.email && <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>{lead.email}</div>}
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <StatusPill status={lead.status} />
                            {lead.nurture_locked_until && new Date(lead.nurture_locked_until).getTime() <= Date.now() && (
                              <span style={{ fontSize: '0.7rem', color: '#f59e0b', padding: '0.25rem 0.5rem', borderRadius: '0.4rem', border: '1px solid rgba(245,158,11,0.18)' }}>
                                Snooze expired
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{lead.source || "-"}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Quick Add controls + Add Lead button (modal) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setQuickAddOpen((v) => !v);
                  }}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "0.6rem",
                    border: "1px solid #374151",
                    backgroundColor: quickAddOpen ? "rgba(55,65,81,0.6)" : "transparent",
                    color: "#f9fafb",
                    cursor: "pointer",
                  }}
                >
                  {quickAddOpen ? "Close Quick Add" : "Quick Add"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setAddModalOpen(true);
                  }}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "0.6rem",
                    border: "1px solid #374151",
                    backgroundColor: "rgba(37,99,235,0.9)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  + Add Lead
                </button>
              </div>

              {quickAddOpen && (
                <form
                  onSubmit={async (evt) => {
                    evt.preventDefault();
                    const ok = await addLead();
                    if (ok) {
                      setQuickAddOpen(false);
                    }
                  }}
                  style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center" }}
                >
                  <input
                    ref={quickAddNameRef}
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ padding: "0.45rem 0.6rem", borderRadius: "0.5rem", border: "1px solid #374151", backgroundColor: "rgba(15,23,42,0.9)", color: "#f9fafb", width: "40%" }}
                  />

                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ padding: "0.45rem 0.6rem", borderRadius: "0.5rem", border: "1px solid #374151", backgroundColor: "rgba(15,23,42,0.9)", color: "#f9fafb", width: "35%" }}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    style={{ padding: "0.45rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #374151", backgroundColor: loading ? "rgba(55,65,81,0.6)" : "rgba(37,99,235,0.9)", color: "#fff", cursor: loading ? "default" : "pointer" }}
                  >
                    {loading ? "Adding..." : "Add"}
                  </button>
                </form>
              )}
            </div>
          </div>
          )}

          {/* RIGHT COLUMN – Conversation */}
          
              {!(isMobile && !isDetailViewOpen) && (
              <aside
                  className={`h-full ${isDetailViewOpen ? 'flex w-full flex-col' : 'hidden md:flex md:flex-col'}`}
                  style={{
                    flex: 1.2,
                    borderRadius: "1rem",
                   border: "1px solid #1f2937",
                   padding: "1rem 1.5rem 1.5rem", // less top padding
                   height: '100%',
                   minHeight: 0, // allow inner flex children to shrink/scroll
                 }}
                >
            {/* Conversation header: automation toggle + jump/auto-scroll controls */}
            <div
              style={{
                display: rightTab === 'conversation' ? "flex" : "none",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
                padding: "0.25rem 0.25rem",
                flexWrap: "wrap",
              }}
            >
              {/* spacer: the automation status is shown as a pill at top-right */}
              <div style={{ minWidth: '8px' }} />

                {/* Mobile back button: shown only on small screens when in detail view */}
                {isDetailViewOpen && (
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    className="md:hidden"
                    style={{
                      marginRight: '0.5rem',
                      padding: '0.25rem 0.45rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #374151',
                      background: 'transparent',
                      color: '#cbd5e1'
                    }}
                  >
                    ← Back
                  </button>
                )}

              <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                {isScrolledUp && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom(true)}
                    title="Jump to latest message"
                    aria-label="Jump to latest message"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.35rem 0.6rem",
                      borderRadius: "999px",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(59,130,246,0.9)",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    ⬇ Jump to Latest
                  </button>
                )}

                {/* Auto-scroll toggle: hide on small screens to avoid UI overlap */}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => setAutoScrollAlways((v) => !v)}
                    title={autoScrollAlways ? "Auto-scroll: always" : "Auto-scroll: only when near bottom"}
                    aria-pressed={autoScrollAlways}
                    aria-label="Toggle auto-scroll behavior"
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "999px",
                      border: "1px solid #374151",
                      backgroundColor: autoScrollAlways ? "rgba(16,185,129,0.15)" : "rgba(55,65,81,0.4)",
                      color: autoScrollAlways ? "#6ee7b7" : "#9ca3af",
                      cursor: "pointer",
                    }}
                  >
                    {autoScrollAlways ? "Auto: Always" : "Auto: Near Bottom"}
                  </button>
                )}
              </div>
            </div>

            {/* Mobile-only compact header: visible when detail view is open */}
            {isDetailViewOpen && (
              <div className="ls-mobile-header md:hidden">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    style={{ padding: '0.25rem', borderRadius: '0.45rem', border: '1px solid #374151', background: 'transparent', color: '#cbd5e1' }}
                  >
                    ←
                  </button>
                  <div style={{ fontWeight: 600 }}>{selectedLead?.name || 'Conversation'}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{selectedLead?.phone}</div>
                  <button
                    type="button"
                    onClick={handleToggleAutomation}
                    disabled={!selectedLead}
                    title={selectedLead ? (automationPaused ? 'Activate automation' : 'Pause automation') : 'Select a lead to change automation'}
                    aria-pressed={automationPaused}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      backgroundColor: automationPaused ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                      color: automationPaused ? '#fecaca' : '#6ee7b7',
                      border: '1px solid rgba(71,85,105,0.18)',
                      backdropFilter: 'blur(4px)',
                      cursor: selectedLead ? 'pointer' : 'default'
                    }}
                  >
                    {automationPaused ? '⏸' : '🟢'}
                  </button>
                </div>
              </div>
            )}

            <div
              className="ls-conversation-container"
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                borderRadius: "0.75rem",
                border: "1px solid #444",
                padding: "0.75rem 1rem",
                paddingBottom: "4.25rem", // leave room for the reply input
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
              ref={messagesEndRef}
            >
          {/* automation status pill (top-right of conversation) */}
            <div style={{ position: 'absolute', right: '0.85rem', top: '0.6rem', zIndex: 5 }}>
              <button
                type="button"
                onClick={handleToggleAutomation}
                disabled={!selectedLead}
                title={selectedLead ? (automationPaused ? 'Activate automation' : 'Pause automation') : 'Select a lead to change automation'}
                aria-pressed={automationPaused}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  backgroundColor: automationPaused ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: automationPaused ? '#fecaca' : '#6ee7b7',
                  border: '1px solid rgba(71,85,105,0.18)',
                  backdropFilter: 'blur(4px)',
                  cursor: selectedLead ? 'pointer' : 'default'
                }}
              >
                {automationPaused ? '⏸ Automation Paused' : '🟢 Automation Active'}
              </button>
            </div>
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
                  new Date(selectedLead.created_at).toLocaleTimeString("en-US", {
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
              className="ls-message-bubble"
              style={{
                display: 'inline-block',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                maxWidth: '72%',
                backgroundColor: isInbound ? '#1f2937' : '#2563eb', // lead: gray-800, agent: blue-600
                color: '#fff',
                fontSize: '0.9rem',
                lineHeight: 1.25,
                // push outbound (agent) messages to the right and inbound to the left
                marginLeft: isInbound ? undefined : 'auto',
                marginRight: isInbound ? 'auto' : undefined,
                boxShadow: isInbound ? 'none' : '0 6px 18px rgba(37,99,235,0.12)',
                border: '1px solid rgba(255,255,255,0.03)'
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
            <div className="ls-reply-form" style={{ flexShrink: 0 }}>
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

              {/* Live preview of variable interpolation to build trust */}
              {replyText.trim() ? (
                (() => {
                  const preview = generatePreview(replyText);
                  const unresolved = (preview.match(/\{\w+\}/g) || []).map((s) => s);
                  return (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div
                        style={{
                          padding: "0.5rem 0.75rem",
                          borderRadius: "0.5rem",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid #2b3440",
                          color: "#e5e7eb",
                          fontSize: "0.9rem",
                          lineHeight: 1.3,
                        }}
                      >
                        <strong style={{ color: '#9ca3af', marginRight: 6 }}>Preview:</strong>
                        <span>{preview}</span>
                      </div>

                      {unresolved.length > 0 && (
                        <div style={{ marginTop: "0.35rem", color: "#fb7185", fontSize: "0.78rem" }}>
                          Unresolved variables: {unresolved.join(", ")} — they will remain as-is in the sent message.
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : null}

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

            {/* Test SMS button removed */}
          </aside>)}
        </div>
        {/* Add Lead modal */}
        {addModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{
                width: "min(720px, 96%)",
                backgroundColor: "#071023",
                padding: "1rem",
                borderRadius: "0.75rem",
                border: "1px solid #374151",
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              }}
            >
              <h3 style={{ margin: 0, marginBottom: "0.5rem" }}>Add Lead</h3>

              <form onSubmit={handleModalSubmit}>
                <div style={{ marginBottom: "0.5rem" }}>
                  <input
                    ref={modalNameRef}
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      color: "#f9fafb",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      color: "#f9fafb",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "0.5rem" }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      backgroundColor: "rgba(15,23,42,0.9)",
                      color: "#f9fafb",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    style={{
                      padding: "0.45rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      backgroundColor: "transparent",
                      color: "#9ca3af",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      backgroundColor: loading ? "rgba(55,65,81,0.6)" : "rgba(37,99,235,0.9)",
                      color: "#fff",
                      cursor: loading ? "default" : "pointer",
                    }}
                  >
                    {loading ? "Adding..." : "Add Lead"}
                  </button>
                </div>

                {message && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#9ca3af" }}>{message}</p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Pause automation confirmation modal */}
        {showPauseConfirm && selectedLead && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 300,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              style={{
                width: "min(560px, 96%)",
                backgroundColor: "#071023",
                padding: "1rem",
                borderRadius: "0.75rem",
                border: "1px solid #374151",
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              }}
            >
              <h3 style={{ margin: 0, marginBottom: "0.5rem" }}>Pause Automation</h3>

              <p style={{ color: "#cbd5e1" }}>
                Are you sure you want to pause automated nurture messages for <strong>{selectedLead.name || 'this lead'}</strong>?
                Pausing will prevent scheduled nurture messages from being sent to this lead until automation is re-activated.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPauseConfirm(false)}
                  style={{ padding: '0.45rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #374151', backgroundColor: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void performToggleAutomation(true)}
                  style={{ padding: '0.45rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #374151', backgroundColor: 'rgba(239,68,68,0.9)', color: '#fff', cursor: 'pointer' }}
                >
                  Pause Automation
                </button>
              </div>
            </div>
          </div>
        )}

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

          .ls-activity-badge {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: #fb7185; /* red */
            display: inline-block;
            box-shadow: 0 0 0 0 rgba(251,113,133,0.7);
            animation: ls-pulse 1.8s infinite ease-out;
            flex-shrink: 0;
          }

          @keyframes ls-pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(251,113,133,0.7);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(251,113,133,0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(251,113,133,0);
            }
          }

          /* Mobile-specific adjustments */
          @media (max-width: 900px) {
            .ls-conversation-container {
              padding-top: 0.75rem; /* default top padding */
              /* extra room for fixed reply bar + safe-area on phones */
              padding-bottom: calc(6.5rem + env(safe-area-inset-bottom));
            }

            /* When detail view is open, make room for the compact mobile header */
            .detail-open .ls-conversation-container {
              padding-top: calc(0.75rem + 48px);
            }

            .ls-message-bubble {
              max-width: 92% !important;
              word-break: break-word;
            }

            .ls-mobile-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 0.75rem;
              padding: 0.5rem 0;
              border-bottom: 1px solid rgba(255,255,255,0.03);
              background: linear-gradient(180deg, rgba(7,16,35,0.98), rgba(7,16,35,0.95));
              position: sticky;
              top: 0;
              z-index: 40;
            }

            /* Make the reply form fixed at bottom on small screens for easy access */
            /* Only fix the reply bar wrapper when the detail view is open on mobile */
            .detail-open .ls-reply-form {
              position: fixed;
              left: 0;
              right: 0;
              bottom: calc(0px + env(safe-area-inset-bottom));
              padding: 12px;
              background: linear-gradient(180deg, rgba(2,6,23,0.98), rgba(2,6,23,0.96));
              z-index: 300;
              display: block;
            }

            /* When detail is open on mobile, give the conversation area more vertical space */
            .detail-open .ls-conversation-container {
              height: calc(100vh - 196px);
              max-height: calc(100vh - 196px);
            }

            .detail-open .ls-reply-form form {
              width: min(980px, calc(100% - 24px));
              margin: 0 auto;
              display: flex;
              gap: 0.5rem;
              align-items: center;
            }

            /* When detail is NOT open, keep the reply form static/relative so it doesn't float over the master list */
            :not(.detail-open) .ls-reply-form {
              position: relative;
              padding: 0;
              background: transparent;
            }

            .ls-reply-form form input[type="text"] {
              font-size: 1rem;
              padding: 0.65rem 0.85rem;
              border-radius: 999px;
            }

            .ls-reply-form form button[type="submit"] {
              padding: 0.6rem 0.95rem;
            }

            /* Slightly reduce left column visual density on mobile */
            .ls-main-layout > div:first-child {
              padding-bottom: 6rem;
            }

            /* Make sure message list can scroll under the fixed input without being clipped */
            .ls-conversation-container {
              -webkit-overflow-scrolling: touch;
            }

            /* On mobile, limit the lead list to show ~4 items and make it scrollable */
            .ls-lead-list {
              max-height: 360px; /* approx 4 items */
              overflow-y: auto;
              -webkit-overflow-scrolling: touch;
            }
          }
        `}</style>
      </main>
    </>            
  );
}

