// app/lib/inboundIntent.ts

export type InboundIntentKind =
  | "STOP"       // stop / unsubscribe
  | "POSITIVE"   // yes / interested
  | "NEGATIVE"   // no / sold / not interested
  | "NOT_NOW"    // later / months from now
  | "QUESTION"   // ends with ? or looks like a question
  | "UNKNOWN";

export interface InboundIntent {
  kind: InboundIntentKind;
  raw: string;
  normalized: string;
}

/**
 * Very simple keyword-based intent detector.
 * We can make this smarter later, but it's enough to drive automation.
 */
export function analyzeInboundIntent(body: string | null | undefined): InboundIntent {
  const raw = body ?? "";
  const normalized = raw.trim().toLowerCase();

  if (!normalized) {
    return { kind: "UNKNOWN", raw, normalized };
  }

  // STOP / opt-out (keep this one very strong)
  const stopWords = ["stop", "unsubscribe", "remove", "quit", "cancel", "end"];
  if (stopWords.some((w) => normalized === w || normalized.startsWith(w + " "))) {
    return { kind: "STOP", raw, normalized };
  }

  // Positive / yes-ish replies
  const positiveWords = ["yes", "yeah", "yep", "yup", "sure", "absolutely", "sounds good", "interested"];
  if (positiveWords.some((w) => normalized === w || normalized.includes(w))) {
    return { kind: "POSITIVE", raw, normalized };
  }

  // Negative / hard no
  const negativeWords = ["no", "not interested", "no thanks", "leave me alone", "stop texting"];
  if (negativeWords.some((w) => normalized === w || normalized.includes(w))) {
    return { kind: "NEGATIVE", raw, normalized };
  }

  // "Not now" / later
  const laterWords = ["later", "not now", "next year", "few months", "couple months", "maybe later"];
  if (laterWords.some((w) => normalized.includes(w))) {
    return { kind: "NOT_NOW", raw, normalized };
  }

  // Question (very rough)
  if (normalized.endsWith("?") || normalized.startsWith("what") || normalized.startsWith("how")) {
    return { kind: "QUESTION", raw, normalized };
  }

  return { kind: "UNKNOWN", raw, normalized };
}
