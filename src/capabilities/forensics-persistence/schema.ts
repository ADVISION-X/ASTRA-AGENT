type ForensicsChildCapabilityId = "append-record" | "append-artifact" | "read-record-ref" | "read-artifact-ref";
export type ForensicsAppendRecordInput = Readonly<{ missionId: string; runId: string; stepId?: string; capabilityCallId?: string; sourceCapabilityId?: string; sourceChildCapabilityId?: string; recordType: "evidence" | "failure"; recordPayload: Record<string, unknown>; artifactRefs?: string[]; createdAt?: string; idempotencyKey: string }>;
export type ForensicsAppendArtifactInput = Readonly<{ missionId: string; runId: string; capabilityCallId?: string; artifactType: "ai_raw_output" | "other"; mimeType?: string; content?: string | Uint8Array; idempotencyKey: string }>;
export type ForensicsReadRecordRefInput = Readonly<{ recordRef: string }>;
export type ForensicsReadArtifactRefInput = Readonly<{ artifactRef: string }>;

type ProofTiming = Readonly<{ proofId: string; startedAt: string; endedAt: string; durationMs: number }>;
type FailureProof<K extends ForensicsChildCapabilityId> = ProofTiming & Readonly<{ childCapabilityId: K; status: "failed"; failureReason: string; missionId?: string; runId?: string; recordRef?: string; artifactRef?: string }>;
type AppendRecordSuccessProof = ProofTiming & Readonly<{ childCapabilityId: "append-record"; status: "success"; missionId: string; runId: string; capabilityCallId?: string | undefined; recordRef: string; storageRef: string; integrityHash: string }>;
type AppendArtifactSuccessProof = ProofTiming & Readonly<{ childCapabilityId: "append-artifact"; status: "success"; missionId: string; runId: string; capabilityCallId?: string | undefined; artifactRef: string; storageRef: string; integrityHash: string }>;
type ReadRecordSuccessProof = ProofTiming & Readonly<{ childCapabilityId: "read-record-ref"; status: "success"; recordRef: string }>;
type ReadArtifactSuccessProof = ProofTiming & Readonly<{ childCapabilityId: "read-artifact-ref"; status: "success"; artifactRef: string; integrityHash: string }>;

export type ForensicsAppendRecordResult = Readonly<{ status: "success"; recordRef: string; proof: AppendRecordSuccessProof }> | Readonly<{ status: "failed"; failureReason: string; proof: FailureProof<"append-record"> }>;
export type ForensicsAppendArtifactResult = Readonly<{ status: "success"; artifactRef: string; proof: AppendArtifactSuccessProof }> | Readonly<{ status: "failed"; failureReason: string; proof: FailureProof<"append-artifact"> }>;
export type ForensicsReadRecordResult = Readonly<{ status: "success"; recordRef: string; record: Record<string, unknown>; proof: ReadRecordSuccessProof }> | Readonly<{ status: "failed"; failureReason: string; proof: FailureProof<"read-record-ref"> }>;
export type ForensicsReadArtifactResult = Readonly<{ status: "success"; artifactRef: string; artifact: Readonly<{ content: Uint8Array; mimeType?: string; integrityHash: string }>; proof: ReadArtifactSuccessProof }> | Readonly<{ status: "failed"; failureReason: string; proof: FailureProof<"read-artifact-ref"> }>;
