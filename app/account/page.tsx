'use client';

export default function AccountPage() {
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
        Account
      </h1>
      <p style={{ color: "#9ca3af", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
        Manage your profile and subscription.
      </p>

      {/* Profile info */}
      <section
        style={{
          padding: "1.5rem",
          borderRadius: "1rem",
          border: "1px solid #1f2937",
          marginBottom: "1.25rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Profile
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            fontSize: "0.9rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Name</div>
            <div style={{ marginTop: "0.25rem" }}>Your Agent Name</div>
          </div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Email</div>
            <div style={{ marginTop: "0.25rem" }}>you@example.com</div>
          </div>

          <div>
            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Market</div>
            <div style={{ marginTop: "0.25rem" }}>Ottawa / GTA (example)</div>
          </div>
        </div>
      </section>

      {/* Plan info */}
      <section
        style={{
          padding: "1.5rem",
          borderRadius: "1rem",
          border: "1px solid #1f2937",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Plan & billing
        </h2>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            fontSize: "0.9rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Current plan</div>
            <div style={{ marginTop: "0.25rem" }}>
              <strong>Solo Agent</strong> · $79 / month
            </div>
            <div
              style={{
                marginTop: "0.35rem",
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              Unlimited nurture sequences for up to 500 active leads.
            </div>
          </div>

          <button
            type="button"
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "999px",
              border: "1px solid #374151",
              backgroundColor: "rgba(59,130,246,0.95)",
              color: "#f9fafb",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Manage billing (coming soon)
          </button>
        </div>
      </section>
    </main>
  );
}
