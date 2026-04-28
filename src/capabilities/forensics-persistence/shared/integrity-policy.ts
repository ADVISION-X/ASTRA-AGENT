import type { ForensicsFailureReason } from "./failure.js";
import { createForensicsFailureReason } from "./failure.js";
import type { ForensicsPersistencePolicy } from "./persistence-policy.js";
import type { ForensicsRecordType } from "./record-envelope.js";

export type ForensicsIntegrityPolicy = {
  requireSourceRecordRefs: boolean;
  requireParentRefs: boolean;
  requireArtifactRefs: boolean;
  requireStorageRefOnArtifacts: boolean;
};

export function resolveForensicsIntegrityPolicy(input: {
  recordType: ForensicsRecordType;
  persistencePolicy: ForensicsPersistencePolicy;
  integrityPolicy?: Partial<ForensicsIntegrityPolicy> | undefined;
}): ForensicsIntegrityPolicy {
  const defaults: ForensicsIntegrityPolicy = {
    requireSourceRecordRefs: false,
    requireParentRefs: ["browse_ledger_entry", "evidence_packet", "failed_record", "runtime_snapshot"].includes(input.recordType),
    requireArtifactRefs: ["evidence_record", "evidence_packet", "failed_record"].includes(input.recordType),
    requireStorageRefOnArtifacts: false,
  };

  return {
    ...defaults,
    ...input.integrityPolicy,
    requireParentRefs: input.persistencePolicy.allowPartialRefs ? defaults.requireParentRefs : (input.integrityPolicy?.requireParentRefs ?? defaults.requireParentRefs),
  };
}

export function validateForensicsIntegrity(input: {
  sourceRecordRefsCount: number;
  parentRefsCount: number;
  artifactRefsCount: number;
  hasArtifactStorageRefGap: boolean;
  policy: ForensicsIntegrityPolicy;
  allowPartialRefs: boolean;
}): {
  integrityStatus: "passed" | "partial" | "failed";
  failureReason: ForensicsFailureReason | null;
} {
  const violations: string[] = [];

  if (input.policy.requireSourceRecordRefs && input.sourceRecordRefsCount === 0) {
    violations.push("missing_source_record_refs");
  }
  if (input.policy.requireParentRefs && input.parentRefsCount === 0) {
    violations.push("missing_parent_refs");
  }
  if (input.policy.requireArtifactRefs && input.artifactRefsCount === 0) {
    violations.push("missing_artifact_refs");
  }
  if (input.policy.requireStorageRefOnArtifacts && input.hasArtifactStorageRefGap) {
    violations.push("artifact_storage_ref_missing");
  }

  if (violations.length === 0) {
    return { integrityStatus: "passed", failureReason: null };
  }

  if (input.allowPartialRefs) {
    return {
      integrityStatus: "partial",
      failureReason: createForensicsFailureReason({
        code: "integrity_partial",
        message: `Forensics persisted with partial integrity: ${violations.join(", ")}`,
        detail: violations.join(", "),
      }),
    };
  }

  return {
    integrityStatus: "failed",
    failureReason: createForensicsFailureReason({
      code: "integrity_failed",
      message: `Forensics integrity validation failed: ${violations.join(", ")}`,
      detail: violations.join(", "),
    }),
  };
}