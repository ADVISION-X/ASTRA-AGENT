export type ForensicsAppendArtifactInput = Readonly<{
  missionId: string;
  runId: string;
  capabilityCallId?: string;
  artifactType: "ai_raw_output" | "other";
  mimeType?: string;
  content?: string | Uint8Array;
  idempotencyKey: string;
}>;
export type ForensicsReadArtifactRefInput = Readonly<{ artifactRef: string }>;

type ProofTiming = Readonly<{ proofId: string; startedAt: string; endedAt: string; durationMs: number }>;
type FailureProof<K extends "append-artifact" | "read-artifact-ref"> = ProofTiming & Readonly<{
  childCapabilityId: K;
  status: "failed";
  failureReason: string;
  missionId?: string;
  runId?: string;
  artifactRef?: string;
}>;
type AppendArtifactSuccessProof = ProofTiming & Readonly<{
  childCapabilityId: "append-artifact";
  status: "success";
  missionId: string;
  runId: string;
  capabilityCallId?: string;
  artifactRef: string;
  storageRef: string;
  integrityHash: string;
}>;
type ReadArtifactSuccessProof = ProofTiming & Readonly<{
  childCapabilityId: "read-artifact-ref";
  status: "success";
  artifactRef: string;
  integrityHash: string;
}>;

export type ForensicsAppendArtifactResult =
  | Readonly<{ status: "success"; artifactRef: string; proof: AppendArtifactSuccessProof }>
  | Readonly<{ status: "failed"; failureReason: string; proof: FailureProof<"append-artifact"> }>;
export type ForensicsReadArtifactResult =
  | Readonly<{ status: "success"; artifactRef: string; artifact: Readonly<{
    content: Uint8Array;
    mimeType?: string;
    integrityHash: string;
  }>; proof: ReadArtifactSuccessProof }>
  | Readonly<{ status: "failed"; failureReason: string; proof: FailureProof<"read-artifact-ref"> }>;
