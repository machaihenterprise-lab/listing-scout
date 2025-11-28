"use client";

import { FormEvent, useState } from "react";

export default function SellerOptInPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

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
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.65rem 0.75rem",
                borderRadius: "999px",
                border: "1px solid #2563eb",
                backgroundColor: submitting
                  ? "rgba(37, 99, 235, 0.5)"
                  : "rgba(37, 99, 235, 0.95)",
                color: "#f9fafb",
                fontSize: "0.95rem",
                fontWeight: 500,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "Submitting…" : "Get my selling game plan"}
            </button>
          </form>
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
      </div>
    </main>
  );
}
