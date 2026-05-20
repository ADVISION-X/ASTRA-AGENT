/**
 * hash.ts — Deterministic hash utilities for storage durability proofs.
 *
 * stableJsonHash: deterministic SHA-256 of a JSON-serialisable payload.
 */

import { createHash } from "node:crypto";

export function stableJsonHash(payload: unknown): string {
  const json = JSON.stringify(payload) ?? "";
  return "sha256:" + createHash("sha256").update(json, "utf8").digest("hex");
}
