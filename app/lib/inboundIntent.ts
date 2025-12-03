// app/lib/inboundIntent.ts

export type InboundIntentType = "STOP" | "HELP" | "POSITIVE" | "NEGATIVE" | "OTHER";

export type InboundIntent = {
  type: InboundIntentType;
  raw: string;
};

function normalize(text: string): string {
  return text.trim().toUpperCase();
}

export function analyzeInboundIntent(body: string | null | undefined): InboundIntent {
  if (!body) {
    return { type: "OTHER", raw: "" };
  }

  const raw = body;
  const text = normalize(body);

  // Standard carrier keywords
  if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(text)) {
    return { type: "STOP", raw };
  }

  if (["HELP", "INFO"].includes(text)) {
    return { type: "HELP", raw };
  }

  // Very simple positive / negative heuristic
  const lower = body.toLowerCase();

  if (
    /yes|yeah|yep|sure|sounds good|interested|let's talk|call me|ok/i.test(lower)
  ) {
    return { type: "POSITIVE", raw };
  }

  if (/no thanks|not interested|stop bothering|leave me alone/i.test(lower)) {
    return { type: "NEGATIVE", raw };
  }

  return { type: "OTHER", raw };
}
