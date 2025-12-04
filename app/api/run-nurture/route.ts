import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Telnyx config
const telnyxApiKey = process.env.TELNYX_API_KEY!;
const telnyxMessagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID!;
const telnyxFromNumber = process.env.TELNYX_US_NUMBER!; // e.g. +13479198781
const TELNYX_MESSAGES_URL = "https://api.telnyx.com/v2/messages";

// Optional shared secret so only your cron can trigger this
const nurtureSecret = process.env.NURTURE_SECRET || "";

// Supabase (service role) – server-side only
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const TEMPLATES: Record<string, string> = {
  DAY_1: `Hi {{name}}, it's {{agent}} from Listing Scout. You requested info about selling your home. Are you still thinking about a move this year? (Y/N)`,
  DAY_3: `Hi {{name}}. Two things usually drive a sale: timing or price. Which is more important for you right now?`,
  DAY_7: `Quick question: are you curious what your neighbor's home just sold for? That recent sale price will affect your game plan.`,
  LONG_TERM: `Hi {{name}}. I noticed a few homes sold in your area recently. Are you tracking local prices or should I send you a quick summary?`,
};

type LeadRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  country?: string | null;
  nurture_stage?: string | null;
  next_nurture_at?: string | null;
  last_nurture_sent_at?: string | null;
  agent_id?: string | null;
};

function personalize(template: string, lead: LeadRow) {
  return template
    .replace("{{name}}", lead.name || "there")
    .replace("{{agent}}", "Machaih");
}

// Very simple stage machine for now
function getNextStage(current?: string | null): keyof typeof TEMPLATES {
  const stage = (current || "DAY_1").toUpperCase();
  if (stage === "DAY_1") return "DAY_3";
  if (stage === "DAY_3") return "DAY_7";
  if (stage === "DAY_7") return "LONG_TERM";
  return "LONG_TERM";
}

// How far to push next_nurture_at per stage
function nextNurtureAtForStage(stage: keyof typeof TEMPLATES): string {
  const base = new Date();
  let days = 3;
  if (stage === "DAY_1") days = 2;
  if (stage === "DAY_3") days = 4;
  if (stage === "DAY_7") days = 30;
  if (stage === "LONG_TERM") days = 30;
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

// Normalize US/CA style numbers to E.164
function normalizeToE164(raw: string | null, country?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  const region = country?.toUpperCase();

  // assume US/CA for now
  if (!region || region === "US" || region === "CA") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  }

  return `+${digits}`;
}

async function sendViaTelnyx(to: string, text: string) {
  const res = await fetch(TELNYX_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${telnyxApiKey}`,
    },
    body: JSON.stringify({
      from: telnyxFromNumber,
      to,
      text,
      messaging_profile_id: telnyxMessagingProfileId,
    }),
  });

  const bodyText = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }

  console.log("[run-nurture] Telnyx status:", res.status);
  console.log("[run-nurture] Telnyx body:", body);

  if (!res.ok) {
    throw new Error(`Telnyx error ${res.status}: ${bodyText}`);
  }

  return body;
}

async function runNurtureOnce() {
  const nowIso = new Date().toISOString();

  // 🔹 If your nurture fields live on `tasks` instead of `leads`, change "leads" -> "tasks" here.
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, phone, country, nurture_stage, next_nurture_at, last_nurture_sent_at")
    .lte("next_nurture_at", nowIso)
    .order("next_nurture_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[run-nurture] Supabase select error:", error);
    throw new Error(error.message);
  }

  if (!leads || leads.length === 0) {
    console.log("[run-nurture] No leads due for nurture");
    return { sentCount: 0 };
  }

  console.log("[run-nurture] Due leads:", leads.length);

  let sentCount = 0;
  const now = new Date().toISOString();

  for (const lead of leads as LeadRow[]) {
    try {
      const to = normalizeToE164(lead.phone ?? null, lead.country ?? null);
      if (!to) {
        console.warn("[run-nurture] Skipping lead with invalid phone", lead.id, lead.phone);
        continue;
      }

      const currentStage = (lead.nurture_stage as string | null) || "DAY_1";
      const nextStage = getNextStage(currentStage);
      const template = TEMPLATES[currentStage as keyof typeof TEMPLATES] || TEMPLATES.DAY_1;
      const text = personalize(template, lead);

      // 1) Send SMS via Telnyx
      await sendViaTelnyx(to, text);

      // 2) Log outbound in messages
      await supabase.from("messages").insert({
        lead_id: lead.id,
        direction: "OUTBOUND",
        channel: "SMS",
        body: text,
        is_auto: true,
      });

      // 3) Update lead nurture fields
      await supabase
        .from("leads")
        .update({
          last_nurture_sent_at: now,
          next_nurture_at: nextNurtureAtForStage(nextStage),
          nurture_stage: nextStage,
        })
        .eq("id", lead.id);

      sentCount++;
    } catch (err) {
      console.error("[run-nurture] Error nurturing lead", lead.id, err);
    }
  }

  return { sentCount };
}

async function handleRun(req: Request) {
  try {
    // ✅ Optional protection: require secret in body if set
    if (nurtureSecret) {
      const body = (await req.json().catch(() => ({}))) as { secret?: string };
      if (body.secret !== nurtureSecret) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
    }

    const { sentCount } = await runNurtureOnce();
    return NextResponse.json({ ok: true, sentCount }, { status: 200 });
  } catch (err: unknown) {
    console.error("[run-nurture] Fatal error", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handleRun(req);
}

// GET handler just so you can test quickly in the browser if needed
export async function GET(req: Request) {
  return handleRun(req);
}
