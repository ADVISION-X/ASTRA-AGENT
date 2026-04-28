import type { ForensicsArtifactRef } from "./artifact-ref.js";
import type { ForensicsRecordRef } from "./record-ref.js";

export type ForensicsRuntimeProof = {
  proofId: string;
  emittedAt: string;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string;
  inputRecordRefs: ForensicsRecordRef[];
  outputRecordRefs: ForensicsRecordRef[];
  artifactRefs: ForensicsArtifactRef[];
  integrityStatus: "passed" | "partial" | "failed";
  debugLogRef: string | null;
};