/**
 * hash.ts — Deterministic hash utilities for storage durability proofs.
 *
 * stableJsonHash: deterministic SHA-256 of a JSON-serialisable payload.
 * sha256Bytes: SHA-256 of raw binary / string content.
 */

import { createHash } from "node:crypto";

export function stableJsonHash(payload: unknown): string {
  const json = JSON.stringify(payload) ?? "";
  return "sha256:" + createHash("sha256").update(json, "utf8").digest("hex");
}

export function sha256Bytes(data: Uint8Array | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
}
