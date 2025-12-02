"use client";

export default function TestActivity() {
  async function runTest() {
    try {
      const res = await fetch("/api/activity-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastSeen: null }),
      });

      const data = await res.json();
      console.log("Activity Summary Result:", data);
      alert("Check the browser console for the full JSON response.");
    } catch (err) {
      console.error("Error calling /api/activity-summary:", err);
      alert("Something went wrong. Check the console for details.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>
          Test Activity Summary
        </h1>
        <button
          onClick={runTest}
          style={{
            padding: "0.9rem 1.8rem",
            borderRadius: "999px",
            border: "1px solid #374151",
            backgroundColor: "#4f46e5",
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          Run Test
        </button>
      </div>
    </div>
  );
}
