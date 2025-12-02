'use client';

import { useState } from "react";

export default function SettingsPage() {
  // Local-only state for now; later we’ll load/save via Supabase
  const [timezone, setTimezone] = useState("America/Toronto");
  const [quietHoursStart, setQuietHoursStart] = useState("20:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [dailySummaryTime, setDailySummaryTime] = useState("17:00");

  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: "900px",
        margin: "0 auto",
        padding: "2rem 1rem 4rem",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#f9fafb",
        backgroundColor: "#020617",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
        Settings
      </h1>
      <p style={{ color: "#9ca3af", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
        Control how Listing Scout sends messages and surfaces follow-up work.
      </p>

      {/* Messaging / Quiet hours */}
      <section
        style={{
          padding: "1.5rem",
          borderRadius: "1rem",
          border: "1px solid #1f2937",
          marginBottom: "1.25rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Messaging schedule
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <label style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              Time zone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.75rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
                fontSize: "0.9rem",
              }}
            >
              <option value="America/Toronto">America / Toronto</option>
              <option value="America/New_York">America / New York</option>
              <option value="America/Los_Angeles">America / Los Angeles</option>
              <option value="America/Vancouver">America / Vancouver</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              Quiet hours start
            </label>
            <input
              type="time"
              value={quietHoursStart}
              onChange={(e) => setQuietHoursStart(e.target.value)}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.75rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              Quiet hours end
            </label>
            <input
              type="time"
              value={quietHoursEnd}
              onChange={(e) => setQuietHoursEnd(e.target.value)}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.75rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
            />
          </div>
        </div>

        <p
          style={{
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "#9ca3af",
          }}
        >
          Listing Scout won&apos;t send **automated** nurture messages during quiet
          hours. (Manual replies from you still send immediately.)
        </p>
      </section>

      {/* Daily summary / notifications */}
      <section
        style={{
          padding: "1.5rem",
          borderRadius: "1rem",
          border: "1px solid #1f2937",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Notifications
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            fontSize: "0.9rem",
          }}
        >
          <div>
            <label style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
              Daily summary time
            </label>
            <input
              type="time"
              value={dailySummaryTime}
              onChange={(e) => setDailySummaryTime(e.target.value)}
              style={{
                marginTop: "0.25rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "0.75rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.9)",
                color: "#f9fafb",
              }}
            />
            <p
              style={{
                marginTop: "0.35rem",
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              When you start sending real alerts, you can use this as the time to
              send a “here&apos;s what Listing Scout did today” summary.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
