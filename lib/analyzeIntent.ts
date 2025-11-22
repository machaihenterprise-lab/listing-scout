// lib/analyzeIntent.ts

export type IntentResult =
  | "STOP"
  | "NURTURE_ONLY"
  | "HOT_APPOINTMENT"
  | "HOT_VALUATION"
  | "HOT_CALL_REQUEST"
  | "HOT_GENERAL"
  | "UNKNOWN";

const STOP_KEYWORDS = [
  "stop",
  "unsubscribe",
  "remove",
  "do not text",
  "don't text",
  "no messages",
];

const APPOINTMENT_KEYWORDS = [
  "meet",
  "come over",
  "stop by",
  "visit",
  "appointment",
  "schedule",
  "available",
  "see the house",
  "view",
  "tomorrow",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "weekend",
  "morning",
  "afternoon",
];

const VALUATION_KEYWORDS = [
  "how much",
  "worth",
  "value",
  "price",
  "estimate",
  "equity",
  "comp",
  "market analysis",
  "cma",
  "numbers",
  "offer",
];

const CALL_KEYWORDS = [
  "call me",
  "call please",
  "call pls",
  "phone",
  "speak",
  "talk",
  "chat",
  "give me a ring",
  "reach out",
];

const AFFIRMATIVE_KEYWORDS = [
  "yes",
  "sure",
  "absolutely",
  "definitely",
  "yep",
  "yeah",
  "please",
  "interested",
  "go ahead",
  "ok",
  "okay",
];

const NEGATION_KEYWORDS = [
  "don't",
  "do not",
  "cant",
  "can't",
  "stop",
  "no",
  "prefer text",
  "text only",
  "work",
];

const DELAY_KEYWORDS = [
  "but",
  "later",
  "not now",
  "wait",
  "future",
  "next year",
  "spring",
];

function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Check if there's a negation (NEGATION_KEYWORDS) within 3 words
 * before a "call"-type keyword.
 *
 * This is a conservative approximation of:
 * "Please don't call me" → true
 * "Can you call me"      → false
 */
function hasDontCallPattern(message: string): boolean {
  const lower = normalizeMessage(message);
  const tokens = lower.split(/\s+/);

  const isNegationToken = (token: string) => {
    const clean = token.replace(/[^\w']/g, "");
    return NEGATION_KEYWORDS.some((neg) => neg.split(" ").includes(clean));
  };

  const isCallToken = (token: string) => {
    const clean = token.replace(/[^\w']/g, "");
    // Look for "call" / "phone" / "ring" roots
    return (
      clean === "call" ||
      clean === "phone" ||
      clean === "ring" ||
      CALL_KEYWORDS.some((phrase) => phrase.includes(clean))
    );
  };

  for (let i = 0; i < tokens.length; i++) {
    if (!isCallToken(tokens[i])) continue;

    // Look back up to 3 tokens for a negation
    const start = Math.max(0, i - 3);
    for (let j = start; j < i; j++) {
      if (isNegationToken(tokens[j])) {
        return true;
      }
    }
  }

  // Also catch pure "prefer text" style messages even without "call"
  if (containsAny(lower, ["prefer text", "text only"])) {
    return true;
  }

  return false;
}

/**
 * Check if we have an affirmative followed by a "delay" phrase (e.g. "yes but later").
 * Approximate by comparing indexOf positions.
 */
function hasNotReadyPattern(message: string): boolean {
  const lower = normalizeMessage(message);

  let earliestAffirmativeIndex = Infinity;
  for (const aff of AFFIRMATIVE_KEYWORDS) {
    const idx = lower.indexOf(aff);
    if (idx !== -1 && idx < earliestAffirmativeIndex) {
      earliestAffirmativeIndex = idx;
    }
  }
  if (earliestAffirmativeIndex === Infinity) return false;

  let earliestDelayIndex = Infinity;
  for (const delay of DELAY_KEYWORDS) {
    const idx = lower.indexOf(delay);
    if (idx !== -1 && idx < earliestDelayIndex) {
      earliestDelayIndex = idx;
    }
  }
  if (earliestDelayIndex === Infinity) return false;

  // Only treat as "not ready" if the delay phrase appears AFTER the affirmative
  return earliestDelayIndex > earliestAffirmativeIndex;
}

export function analyzeIntent(message: string): IntentResult {
  const lower = normalizeMessage(message);

  // 1) Global STOP / compliance
  if (containsAny(lower, STOP_KEYWORDS)) {
    return "STOP";
  }

  // 2) Agent protector: don't-call & not-ready filters

  // 2A) Don't Call filter (around "call" phrases)
  if (hasDontCallPattern(lower)) {
    return "NURTURE_ONLY";
  }

  // 2B) Not Ready filter (affirmative + delay)
  if (hasNotReadyPattern(lower)) {
    return "NURTURE_ONLY";
  }

  // 3) HOT intent checks (in value order)

  // Appointment / logistics (strongest)
  if (containsAny(lower, APPOINTMENT_KEYWORDS)) {
    return "HOT_APPOINTMENT";
  }

  // Call / phone channel switch
  if (containsAny(lower, CALL_KEYWORDS)) {
    return "HOT_CALL_REQUEST";
  }

  // Valuation / money interest
  if (containsAny(lower, VALUATION_KEYWORDS)) {
    return "HOT_VALUATION";
  }

  // Strong affirmative replies
  if (containsAny(lower, AFFIRMATIVE_KEYWORDS)) {
    return "HOT_GENERAL";
  }

  // 4) Fallback
  return "UNKNOWN";
}
