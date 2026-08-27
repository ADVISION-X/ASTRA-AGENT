/**
 * refs.ts — Ref-generation utilities for record and artifact references.
 *
 * References are content-addressed from the governed idempotency identity.
 */

import { createHash } from "node:crypto";

const refHash = (identity: string): string =>
  createHash("sha256").update(identity, "utf8").digest("hex");

export function createRecordRef(identity: string): string {
  return `rec-${refHash(`record\0${identity}`)}`;
}

export function createArtifactRef(identity: string): string {
  return `art-${refHash(`artifact\0${identity}`)}`;
}
