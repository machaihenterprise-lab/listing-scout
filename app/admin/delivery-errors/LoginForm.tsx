"use client";
import React, { useState } from "react";

export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || "Invalid password");
      } else {
        setPassword("");
        if (onSuccess) onSuccess();
        // reload to show protected content
        window.location.reload();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="p-4 max-w-md">
      <label className="block text-sm font-medium mb-2">Admin Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border rounded px-2 py-1"
        placeholder="Enter admin password"
      />
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="mt-3">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
