# Listing Scout — Copilot Instructions

## Project Overview

**Listing Scout** is a Next.js real estate lead nurture platform that manages seller leads through SMS-based outreach and automated follow-ups. The system tracks lead intent from inbound messages, classifies them into buckets (HOT, NURTURE), and orchestrates multi-stage SMS nurture sequences.

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, TypeScript
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Edge Functions)
- **SMS Providers**: Telnyx (inbound + outbound/nurture), webhook integration
- **Real-time UI**: 5-second polling for message updates, local echo for immediate feedback

---

## Architecture Concepts

### Three Service Tiers

1. **Telnyx** (`app/api/telnyx-inbound/route.ts`)
   - Receives inbound SMS via webhook
   - Matches phone → lead lookup
   - Stores message in Supabase
   - Updates `last_contacted_at` on reply
   - **Key pattern**: Returns 200 even for unknown numbers; logs them without lead association

2. **Telnyx (nurture)** (via `supabase/functions/run-nurture-cycle/`)
   - Sends auto-triggered nurture SMS in DAY_1, DAY_2, DAY_3, DAY_5, DAY_7 stages
   - Uses Deno runtime in Supabase Functions
   - Service role client (full permissions) to update lead state post-send
   - **Note**: Only handles auto messages (`is_auto: true`)

3. **Manual Replies** (`app/api/reply-sms/route.ts`)
   - User-initiated SMS from dashboard
   - Uses Telnyx API (not Twilio) for manual sends
   - **Critical detail**: Sets `is_auto: false` to distinguish from nurture bot

### Data Flow

```
Lead Created (manual) → status: NURTURE, nurture_stage: DAY_1
                      ↓
          run-nurture-cycle (scheduled job)
                      ↓
      DAY_1 SMS sent via Telnyx → last_nurture_sent_at updated
                      ↓
       computeNextNurture() → next_nurture_at = NOW + 24h + jitter
                      ↓
      Business hours filter (9:15 AM - 8:00 PM)
                      ↓
          Inbound SMS received → analyzeIntent()
                      ↓
    Intent: HOT_APPOINTMENT? → status: HOT
    Intent: STOP?             → nurture_status: STOPPED
    Intent: NURTURE_ONLY?    → stay in nurture loop
```

---

## Key Data Model Patterns

### Lead Table Fields
- `status`: "HOT" | "NURTURE" (driver for dashboard grouping)
- `nurture_status`: "ACTIVE" | "STOPPED" (compliance gate)
- `nurture_stage`: "DAY_1" | "DAY_2" | "DAY_3" | "DAY_5" | "DAY_7"
- `next_nurture_at`: ISO timestamp (query target for run-nurture-cycle)
- `nurture_locked_until`: ISO timestamp (prevents duplicate sends within lock window)
- `last_contacted_at`: ISO timestamp (updated on both inbound + outbound user replies)

### Messages Table Fields
- `is_auto: boolean` – false = manual user reply, true = auto nurture message
- `direction: "INBOUND" | "OUTBOUND"`
- `channel: "SMS" | null` (designed for future channels)
- `lead_id: string | null` – null if message from unknown number

---

## Critical Patterns to Know

### 1. **Local Echo for Optimistic Updates**
   - When user sends reply in `handleSendReply`, we:
     1. POST to `/api/reply-sms`
     2. **Immediately** add message to conversation state with temp ID (`local-${timestamp}`)
     3. **Never** call `fetchMessages` right after — 5s polling will pick it up from DB
   - If you poll immediately, you risk overwriting the local message before DB sync
   - See: `app/page.tsx` (reply composer + message list state)

### 2. **Intent Classification System** (`lib/analyzeIntent.ts`)
   - **STOP keywords** (compliance): "stop", "unsubscribe", "do not text"
   - **Protected patterns**: 
     - `hasDontCallPattern()` — catches "don't call me" even 3 words apart
     - `hasNotReadyPattern()` — detects "yes but later" (affirmative + delay phrase)
   - **HOT intents** (priority order):
     - `HOT_APPOINTMENT` — contains "meet", "tomorrow", "available", etc.
     - `HOT_CALL_REQUEST` — "call me", "speak", "reach out"
     - `HOT_VALUATION` — "how much", "worth", "price", "equity"
     - `HOT_GENERAL` — plain affirmatives ("yes", "sure", "interested")
   - Fallback: `UNKNOWN` (stay in nurture)
   - **TODO**: This intent result is not yet fed back to update lead status in dashboard

### 3. **Nurture Timing** (`lib/nurtureTiming.ts`)
   - **Stage sequence**: DAY_1 → DAY_2 (24h) → DAY_3 (24h) → DAY_5 (48h) → DAY_7 (48h)
   - **After DAY_7**: stops tight loop (handoff to long-term drip planned)
   - **Jitter**: ±15–65 minutes per stage (Bot Breaker: avoid predictable timing)
   - **Safety Valve**: times outside 9:15 AM – 8:00 PM shift to next valid window
   - **Calculation**: `computeNextNurture(currentStage, previousSentAtISO)` → `{nextStage, nextNurtureAt}`

### 4. **Environment Variable Separation**
   - **Telnyx (manual/inbound)**: `TELNYX_API_KEY`, `TELNYX_MESSAGING_PROFILE_ID`, `TELNYX_US_NUMBER`
   - **Telnyx (auto nurture)**: same Telnyx envs, used from Supabase Edge Function
   - **Supabase (frontend/API)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Supabase (service role / cron)**: `SUPABASE_SERVICE_ROLE_KEY` (see `app/api/activity-summary` and `.github/workflows/*`)
   - **Current RLS Status**: Tables are world-readable in dev; lock down for production

---

## Developer Workflows

### Running Locally
```bash
npm run dev     # Start Next.js dev server (port 3000)
npm run build   # TypeScript + Next.js build
npm run lint    # ESLint check
```

### Testing Nurture Cycle
- `run-nurture-cycle` is a Supabase Edge Function (Deno)
- Deploy: `supabase functions deploy`
- Must set env vars in Supabase project settings or `supabase/config.toml`
- No local emulator; test by triggering manually or via Supabase dashboard

### Webhook Testing (Telnyx Inbound)
- Telnyx webhook URL: `https://your-domain/api/telnyx-inbound`
- Endpoint expects `POST` with `payload.data.event_type = "message.received"`
- GET also accepted (health check)
- Use Telnyx sandbox or webhook replay feature to test locally (requires ngrok or similar)

### SMS Provider Quirks
- **Telnyx**: Manual/inbound/nurture; returns `data.id` on success; validates `messaging_profile_id`
- Both have rate limits; watch throughput and retries

---

## Common Tasks & Gotchas

### Adding a New Nurture Stage
1. Add to `STAGE_SEQUENCE` in `nurtureTiming.ts`
2. Add template to `NURTURE_TEMPLATES` in `run-nurture-cycle/index.ts`
3. Update `STAGE_NEXT_OFFSET_HOURS` with next offset
4. **Gotcha**: If offset is 0 (end of loop), loop stops and hands off

### Updating Intent Logic
- Always test both positive and negative cases in `analyzeIntent.ts`
- The keyword lists are conservative (short substrings); longer phrases may not match
- Remember: intent is currently analyzed but **not** fed back to dashboard status
- **TODO**: Wire `analyzeIntent` result into lead status update flow

### Pausing Automation for a Lead
- Dashboard has "⏸ Automation Paused" toggle (currently UI-only)
- Set `nurture_status: "PAUSED"` in DB to actually gate sends
- `run-nurture-cycle` checks `.eq("nurture_status", "ACTIVE")` in its query

### Handling Undeliverable/Invalid Numbers
- Telnyx/Twilio return errors; catch in try/catch and log
- Lead record remains unchanged (no auto-status flip to avoid data loss)
- Manual review recommended for recurring failures

---

## File Navigation

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Main React dashboard (leads list, chat, reply form, polling) |
| `app/api/reply-sms/route.ts` | Manual reply endpoint (Telnyx send + log) |
| `app/api/telnyx-inbound/route.ts` | Webhook receiver (inbound SMS → lead lookup) |
| `lib/supabaseClient.ts` | Supabase client init (anon key) |
| `lib/analyzeIntent.ts` | Intent classifier (keyword-based) |
| `lib/nurtureTiming.ts` | Stage progression & timing logic |
| `supabase/functions/run-nurture-cycle/` | Deno Edge Function (scheduled; sends auto SMS) |
| `supabase/config.toml` | Supabase project config (local reference) |

---

## Next Steps / TODOs

- [ ] Wire `analyzeIntent()` result into dashboard lead status (currently dead code)
- [ ] Implement long-term drip campaign after DAY_7 tight loop
- [ ] Enable Row-Level Security (RLS) on Supabase tables
- [ ] Add AI-powered message suggestion/auto-reply (currently just templates)
- [ ] Extend to multiple SMS providers / failover logic
- [ ] Metrics dashboard (sent/delivered/reply rates, intent breakdown)
