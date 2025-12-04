"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type LeadProfileProps = {
  leadId: string;
};

type ProfileData = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
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

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [targetAreas, setTargetAreas] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [moveTimeline, setMoveTimeline] = useState("");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);

  const applyDataToState = (d: ProfileData) => {
    setName(d.name || "");
    setPhone(d.phone || "");
    setEmail(d.email || "");
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
          try {
            const stored = window.localStorage.getItem(`lead_tags_${leadId}`);
            if (stored) setTags(JSON.parse(stored));
          } catch {}
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
          name: name || null,
          phone: phone || null,
          email: email || null,
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
      try {
        window.localStorage.setItem(`lead_tags_${leadId}`, JSON.stringify(tags));
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
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
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="Lead name"
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.65rem",
                borderRadius: "0.55rem",
                border: "1px solid #374151",
                background: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Source</label>
            <select
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
            >
              <option value="">Select source</option>
              <option value="manual">Manual</option>
              <option value="website">Website</option>
              <option value="import">Import</option>
              <option value="zillow">Zillow</option>
              <option value="referral">Referral</option>
            </select>
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
    </div>
  );
}
