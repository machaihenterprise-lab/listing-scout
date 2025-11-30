"use client";
import React, { useState } from "react";

export default function Actions({ onDone }: { onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clearAll() {
    if (!confirm("Delete ALL delivery errors? This cannot be undone.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/delivery-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || "Failed to clear");
      } else {
        if (onDone) onDone();
        window.location.reload();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={clearAll}
        className="px-3 py-1 bg-red-600 text-white rounded"
        disabled={loading}
      >
        {loading ? "Clearing…" : "Clear All Errors"}
      </button>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}
