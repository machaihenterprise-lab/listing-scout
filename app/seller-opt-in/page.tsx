"use client";

import { FormEvent, useState } from "react";

export default function SellerOptInPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

  const trimmedPhone = phone.trim();
  if (!trimmedPhone) {
  setError("Please enter your mobile phone number.");
  return;
}

  if (!consent) {
  setError("Please check the box to agree to receive SMS messages.");
  return;
}

  setError(null);
  setMessage(null);
  setLoading(true);


    // For Telnyx approval we ONLY need the UI + text.
    // You can later replace this with a call to your Supabase API
    // to actually store the lead.
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#020617",
        color: "#f9fafb",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#020617",
          borderRadius: "1rem",
          border: "1px solid #1f2937",
          padding: "1.75rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
          }}
        >
          Get Your Home Selling Game Plan
        </h1>
        <p
          style={{
            fontSize: "0.9rem",
            color: "#9ca3af",
            marginBottom: "1.25rem",
          }}
        >
          Share a few details below and an agent from{" "}
          <strong>FlowEase Studio (Listing Scout)</strong> will follow up with
          pricing, timing, and strategy for your property.
        </p>

        {submitted ? (
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "0.75rem",
              backgroundColor: "rgba(22, 163, 74, 0.12)",
              border: "1px solid rgba(22, 163, 74, 0.35)",
              fontSize: "0.9rem",
            }}
          >
            ✅ Thank you! We&apos;ve received your request. An agent will reach
            out by SMS shortly.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                htmlFor="name"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  marginBottom: "0.25rem",
                }}
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #374151",
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  color: "#f9fafb",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  marginBottom: "0.25rem",
                }}
              >
                Email (optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #374151",
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  color: "#f9fafb",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label
                htmlFor="phone"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  marginBottom: "0.25rem",
                }}
              >
                Mobile phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+1 555 123 4567"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #374151",
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  color: "#f9fafb",
                  fontSize: "0.9rem",
                }}
              />
            </div>

                  <label
                 style={{
                 display: "flex",
                 alignItems: "flex-start",
                 gap: "0.5rem",
                 fontSize: "0.8rem",
                 lineHeight: 1.4,
                 marginTop: "0.75rem",
             }}
           >
        <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: "0.15rem" }}
          />
        <span>
              I agree to receive SMS messages about selling my home and related real
              estate updates from <strong>FlowEase Studio (Listing Scout)</strong>.
              Message &amp; data rates may apply. Message frequency varies. Reply{" "}
             <strong>STOP</strong> to unsubscribe, <strong>HELP</strong> for help.
        </span>
      </label>


             {/* Telnyx / carrier-friendly consent text */}
            <p
              style={{
                fontSize: "0.75rem",
                color: "#9ca3af",
                lineHeight: 1.5,
                marginBottom: "0.9rem",
              }}
            >
              By submitting this form, you agree to receive SMS messages about
              selling your home and real estate updates from{" "}
              <strong>FlowEase Studio (Listing Scout)</strong>. Message and data
              rates may apply. Message frequency varies. Reply{" "}
              <strong>STOP</strong> to unsubscribe or <strong>HELP</strong> for
              help.
            </p>

                      <button
            type="submit"
            disabled={loading || !name.trim() || !phone.trim() || !consent}
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
              cursor:
                loading || !name.trim() || !phone.trim() || !consent
                  ? "default"
                  : "pointer",
              opacity:
                loading || !name.trim() || !phone.trim() || !consent ? 0.6 : 1,
            }}
          >
            {loading ? "Submitting..." : "Get my selling game plan"}
          </button>

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
        )}
        </div>
        </main>
    );
    }