"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type LeadProfileProps = {
  leadId: string;
};

type ProfileData = {
  id: string;
  source: string | null;
  target_areas: string | null;
  target_property_type: string | null;
  move_timeline: string | null;
  target_budget_min: number | null;
  target_budget_max: number | null;
  created_at: string | null;
  status: string | null;
  nurture_status: string | null;
  next_nurture_at: string | null;
};

const formatShortDateTime = (dateString: string | null | undefined) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} at ${timePart}`;
};

export function LeadProfile({ leadId }: LeadProfileProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [source, setSource] = useState("");
  const [targetAreas, setTargetAreas] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [moveTimeline, setMoveTimeline] = useState("");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const applyDataToState = (d: ProfileData) => {
    setSource(d.source || "");
    setTargetAreas(d.target_areas || "");
    setPropertyType(d.target_property_type || "");
    setMoveTimeline(d.move_timeline || "");
    setBudgetMin(d.target_budget_min != null ? String(d.target_budget_min) : "");
    setBudgetMax(d.target_budget_max != null ? String(d.target_budget_max) : "");
  };

  useEffect(() => {
    let abort = false;
    const load = async () => {
      if (!leadId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: err } = await supabase!
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();
        if (err) {
          if (!abort) setError(err.message);
          return;
        }
        if (!abort && rows) {
          const casted = rows as ProfileData;
          setData(casted);
          applyDataToState(casted);
        }
      } catch (e) {
        if (!abort) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!abort) setLoading(false);
      }
    };
    load();
    return () => {
      abort = true;
    };
  }, [leadId]);

  const handleSave = async () => {
    if (!leadId) return;
    setSaving(true);
    setError(null);
    try {
        const { error: updError, data: updated } = await supabase!
          .from("leads")
          .update({
          source: source || null,
          target_areas: targetAreas || null,
          target_property_type: propertyType || null,
          move_timeline: moveTimeline || null,
          target_budget_min: budgetMin ? Number(budgetMin) : null,
          target_budget_max: budgetMax ? Number(budgetMax) : null,
        })
        .eq("id", leadId)
        .select("*")
        .single();

      if (updError) {
        setError(updError.message);
        return;
      }

      const casted = updated as ProfileData;
      setData(casted);
      applyDataToState(casted);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    if (!taskTitle.trim()) {
      setTaskError("Task title is required.");
      return;
    }
    setTaskSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          description: taskTitle.trim(),
          dueAt: taskDueAt || null,
        }),
      });

      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const apiError =
          json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>)["error"] === "string"
            ? ((json as Record<string, unknown>)["error"] as string)
            : undefined;
        setTaskError(apiError || `Failed to create task (status ${res.status}).`);
        return;
      }

      setTaskTitle("");
      setTaskDueAt("");
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : String(err));
    } finally {
      setTaskSaving(false);
    }
  };

  if (loading) {
    return <div style={{ color: "#9ca3af" }}>Loading profile…</div>;
  }

  if (error) {
    return <div style={{ color: "#fb7185" }}>Error loading profile: {error}</div>;
  }

  if (!data) {
    return <div style={{ color: "#9ca3af" }}>No profile data.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          border: "1px solid #1f2937",
          borderRadius: "0.75rem",
          padding: "0.85rem",
          background: "rgba(15,23,42,0.5)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }}>
          <div>
            <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Created</div>
            <div style={{ color: "#e5e7eb" }}>{data.created_at ? formatShortDateTime(data.created_at) : "—"}</div>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Status</div>
            <div style={{ color: "#e5e7eb" }}>{data.status || "—"}</div>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Nurture status</div>
            <div style={{ color: "#e5e7eb" }}>{data.nurture_status || "—"}</div>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Next nurture</div>
            <div style={{ color: "#e5e7eb" }}>{data.next_nurture_at ? formatShortDateTime(data.next_nurture_at) : "—"}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #1f2937",
          borderRadius: "0.75rem",
          padding: "0.85rem",
          background: "rgba(15,23,42,0.65)",
        }}
      >
        <h4 style={{ margin: 0, marginBottom: "0.5rem" }}>Lead Profile</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="Website, Zillow, Manual"
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Target Areas</label>
            <input
              type="text"
              value={targetAreas}
              onChange={(e) => setTargetAreas(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="Interested in Downtown Condos"
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Budget Range</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.65rem",
                  borderRadius: "0.55rem",
                  border: "1px solid #374151",
                  background: "rgba(15,23,42,0.9)",
                  color: "#f9fafb",
                }}
                placeholder="Min"
              />
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.65rem",
                  borderRadius: "0.55rem",
                  border: "1px solid #374151",
                  background: "rgba(15,23,42,0.9)",
                  color: "#f9fafb",
                }}
                placeholder="Max"
              />
            </div>
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Property Type</label>
            <input
              type="text"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="Condo, SFH, etc."
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Move Timeline</label>
            <input
              type="text"
              value={moveTimeline}
              onChange={(e) => setMoveTimeline(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="3-6 months, ASAP, etc."
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            onClick={() => {
              if (data) applyDataToState(data);
            }}
            style={{
              padding: "0.45rem 0.7rem",
              borderRadius: "0.55rem",
              border: "1px solid #374151",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{
              padding: "0.45rem 0.95rem",
              borderRadius: "0.55rem",
              border: "1px solid #2563eb",
              background: saving ? "rgba(37,99,235,0.4)" : "rgba(37,99,235,0.9)",
              color: "#fff",
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #1f2937",
          borderRadius: "0.75rem",
          padding: "0.85rem",
          background: "rgba(15,23,42,0.5)",
        }}
      >
        <h4 style={{ margin: 0, marginBottom: "0.5rem" }}>Add Follow-Up Task</h4>
        <form onSubmit={handleAddTask} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Task title</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="Call about financing next Tuesday"
              required
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Due date/time</label>
            <input
              type="datetime-local"
              value={taskDueAt}
              onChange={(e) => setTaskDueAt(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
            />
          </div>
          {taskError && <div style={{ color: "#fb7185", fontSize: "0.9rem" }}>{taskError}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={taskSaving}
              style={{
                padding: "0.45rem 0.95rem",
                borderRadius: "0.55rem",
                border: "1px solid #2563eb",
                background: taskSaving ? "rgba(37,99,235,0.4)" : "rgba(37,99,235,0.9)",
                color: "#fff",
                cursor: taskSaving ? "default" : "pointer",
              }}
            >
              {taskSaving ? "Saving..." : "+ Add Follow-Up Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
