// app/lib/inboundIntent.ts

export type InboundIntent =
  | { type: "STOP"; score: number }
  | { type: "HELP"; score: number }
  | { type: "POSITIVE"; score: number }
  | { type: "NEGATIVE"; score: number }
  | { type: "OTHER"; score: number };

/**
 * Very simple keyword-based intent detection for inbound SMS.
 * We can make this smarter later, but this is enough to power routing.
 */
export function analyzeInboundIntent(body: string): InboundIntent {
  const text = (body || "").toLowerCase().trim();

  if (!text) {
    return { type: "OTHER", score: 0 };
  }

  // Hard opt-out words
  if (/\bstop\b|\bunsubscribe\b|\bquit\b/.test(text)) {
    return { type: "STOP", score: 1 };
  }

  // Help requests
  if (/\bhelp\b|\bsupport\b|\bwho is this\b|\bwhat is this\b/.test(text)) {
    return { type: "HELP", score: 0.9 };
  }

  // Positive / interested replies
  if (
    /\byes\b|\byeah\b|\byep\b|\bsure\b|\binterested\b|\blet'?s talk\b|\bcall me\b|\bwhen can\b/.test(
      text
    )
  ) {
    return { type: "POSITIVE", score: 0.8 };
  }

  // Negative / not interested
  if (
    /\bno\b|\bnot interested\b|\bstop calling\b|\bdon'?t text\b|\bleave me\b/.test(
      text
    )
  ) {
    return { type: "NEGATIVE", score: 0.8 };
  }

  // Fallback
  return { type: "OTHER", score: 0.2 };
}
