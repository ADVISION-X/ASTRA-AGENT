/**
 * refs.ts — Ref-generation utilities for record and artifact references.
 *
 * createRecordRef: unique ref for an appended record.
 * createArtifactRef: unique ref for an appended artifact.
 */

import { randomUUID } from "node:crypto";

export function createRecordRef(): string {
  return `rec-${randomUUID()}`;
}

export function createArtifactRef(): string {
  return `art-${randomUUID()}`;
}
