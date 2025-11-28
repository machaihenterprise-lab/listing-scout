
"use client";

import { useState } from "react";

export default function SellerOptInPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      setMessage(null);
      return;
    }

    if (!trimmedPhone) {
      setError("Please enter your mobile phone number.");
      setMessage(null);
      return;
    }

    if (!consent) {
      setError("Please check the box to agree to receive SMS messages.");
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // TODO: plug into Supabase or an API route if you want to store these.
      // For now we just simulate a successful submit.
      await new Promise((resolve) => setTimeout(resolve, 700));

      setMessage(
        "Thanks! An agent from FlowEase Studio (Listing Scout) will follow up shortly."
      );
      setName("");
      setEmail("");
      setPhone("");
      setConsent(false);
    } catch (err: any) {
      console.error("Opt-in submit error:", err);
      setError(
        err?.message || "Something went wrong while submitting the form."
      );
    } finally {
      setLoading(false);
    }
  };

  const buttonDisabled =
    loading || !name.trim() || !phone.trim() || !consent;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background:
          "radial-gradient(circle at top, #0f172a 0, #020617 50%, #000 100%)",
        color: "#f9fafb",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          borderRadius: "1.5rem",
          border: "1px solid rgba(148,163,184,0.25)",
          background:
            "radial-gradient(circle at top left, rgba(59,130,246,0.25), transparent 45%), rgba(15,23,42,0.96)",
          padding: "2.25rem 2rem",
          boxShadow: "0 24px 60px rgba(15,23,42,0.7)",
        }}
      >
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 600,
            marginBottom: "0.5rem",
          }}
        >
          Get Your Home Selling Game Plan
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "#d1d5db",
            marginBottom: "1.5rem",
          }}
        >
          Share a few details below and an agent from{" "}
          <strong>FlowEase Studio (Listing Scout)</strong> will follow up with
          pricing, timing, and strategy for your property.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                marginBottom: "0.3rem",
                color: "#e5e7eb",
              }}
            >
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              style={{
                width: "100%",
                padding: "0.75rem 0.9rem",
                borderRadius: "0.9rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.95)",
                color: "#f9fafb",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Email (optional) */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                marginBottom: "0.3rem",
                color: "#9ca3af",
              }}
            >
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "0.75rem 0.9rem",
                borderRadius: "0.9rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.95)",
                color: "#f9fafb",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                marginBottom: "0.3rem",
                color: "#e5e7eb",
              }}
            >
              Mobile phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              style={{
                width: "100%",
                padding: "0.75rem 0.9rem",
                borderRadius: "0.9rem",
                border: "1px solid #374151",
                backgroundColor: "rgba(15,23,42,0.95)",
                color: "#f9fafb",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Checkbox consent */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              fontSize: "0.8rem",
              lineHeight: 1.4,
              marginTop: "0.75rem",
              color: "#e5e7eb",
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>
              I agree to receive SMS messages about selling my home and related
              real estate updates from{" "}
              <strong>FlowEase Studio (Listing Scout)</strong>. Message &amp;
              data rates may apply. Message frequency varies. Reply{" "}
              <strong>STOP</strong> to unsubscribe, <strong>HELP</strong> for
              help.
            </span>
          </label>

             <p style={{ fontSize: "0.75rem", color: "#aaa", marginTop: "0.5rem" }}>
             Your mobile information will not be shared or sold to third parties for marketing or promotional purposes.
           </p>

             <p style={{ fontSize: "0.75rem", color: "#aaa" }}>
             View our <a href="https://www.notion.so" target="_blank" style={{ color: "#66aaff" }}>Privacy Policy</a>.
          </p>


          {/* Extra explicit text (matches what Telnyx wants) */}
          <p
            style={{
              marginTop: "0.55rem",
              fontSize: "0.75rem",
              color: "#9ca3af",
              lineHeight: 1.4,
            }}
          >
            By submitting this form, you agree to receive SMS messages about
            selling your home and real estate updates from FlowEase Studio
            (Listing Scout). Message and data rates may apply. Message frequency
            varies. Reply STOP to unsubscribe or HELP for help.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={buttonDisabled}
            style={{
              marginTop: "1rem",
              width: "100%",
              padding: "0.8rem 1rem",
              borderRadius: "999px",
              border: "none",
              background:
                "linear-gradient(135deg, rgba(59,130,246,1), rgba(37,99,235,1))",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: buttonDisabled ? "default" : "pointer",
              opacity: buttonDisabled ? 0.6 : 1,
            }}
          >
            {loading ? "Submitting..." : "Get my selling game plan"}
          </button>

          {/* Error / success */}
          {error && (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.8rem",
                color: "#f87171",
              }}
            >
              {error}
            </p>
          )}

          {message && (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.8rem",
                color: "#6ee7b7",
              }}
            >
              {message}
            </p>
          )}

          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.7rem",
              color: "#6b7280",
            }}
          >
            FlowEase Studio (Listing Scout) • Real estate seller lead follow-up
            and consultation. You can unsubscribe anytime by replying STOP.
          </p>
        </form>
      </div>
    </main>
  );
}
