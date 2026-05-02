import { createHash } from "node:crypto";

import type { ForensicsArtifactRef, ForensicsRecordRef } from "../schema.js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]);
    return Object.fromEntries(entries);
  }

  return value;
}

export function serializeCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function buildCanonicalForensicsHash(input: {
  recordId: string;
  recordType: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string;
  videoVisitId: string | null;
  stepId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapId: string;
  selectedMapVersion: string;
  activationSnapshotRef: string;
  capabilityCallId: string;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string;
  payload: unknown;
  inputRefs: string[];
  outputRefs: string[];
  sourceRecordRefs: ForensicsRecordRef[];
  parentRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  promptContractId: string | null;
  promptContractVersion: string | null;
  promptCatalogVersion: string | null;
  actionRef: string | null;
  postActionVerificationRef: string | null;
  decisionRef: string | null;
  schemaVersion: string;
  dataQualityFlags: string[];
  createdAt: string;
}): string {
  const canonicalJson = serializeCanonicalJson(input);
  return createHash("sha256").update(canonicalJson).digest("hex");
}