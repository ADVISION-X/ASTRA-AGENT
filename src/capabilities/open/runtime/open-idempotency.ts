import { createHash } from "node:crypto";

import type { OpenIdempotencyPort } from "../ports/open-idempotency-port.js";

function normalizeKeyPart(input: string | null): string {
  return (input ?? "null").trim().toLowerCase();
}

export function buildOpenIdempotencyKey(input: {
  sessionId: string;
  childCapabilityId: string;
  targetUrl: string;
  roundId: string | null;
}): string {
  const seed = [
    normalizeKeyPart(input.sessionId),
    normalizeKeyPart(input.childCapabilityId),
    normalizeKeyPart(input.targetUrl),
    normalizeKeyPart(input.roundId),
  ].join("|");

  return `open-idempotency:${createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

export function createInMemoryOpenIdempotencyPort(): OpenIdempotencyPort {
  const seen = new Set<string>();

  return {
    reserve(input) {
      const idempotencyKey = buildOpenIdempotencyKey(input);
      if (input.currentUrl === input.targetUrl) {
        return {
          ok: true,
          status: "already_on_target",
          idempotencyKey,
          reason: "browser session is already on the governed target url",
        };
      }
      if (seen.has(idempotencyKey) && !input.allowReplay) {
        return {
          ok: false,
          status: "duplicate_skipped",
          idempotencyKey,
          reason: "duplicate open request blocked by governed idempotency policy",
        };
      }

      seen.add(idempotencyKey);
      return {
        ok: true,
        status: "reserved",
        idempotencyKey,
        reason: null,
      };
    },
  };
}