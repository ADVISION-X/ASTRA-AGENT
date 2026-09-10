import { createHash } from "node:crypto";
import type { GptChildCapabilityId, GptChildCapabilityIntent, GptChildCapabilityResult, GptChildInputMap } from "../contract.js";
import type { GptEvidenceStorePort } from "../production-ports.js";

export const acceptanceHash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type StoredEvidence = Readonly<{ recordRef: string; record: Readonly<Record<string, unknown>> }>;
type StoredArtifact = Readonly<{ content: Uint8Array<ArrayBuffer>; mimeType?: string; integrityHash: string }>;

export const createEvidenceHarness = (options: Readonly<{ storeArtifacts?: boolean }> = {}) => {
  const storedByKey = new Map<string, StoredEvidence>();
  const storedByRef = new Map<string, StoredEvidence>();
  const artifactsByRef = new Map<string, StoredArtifact>();
  let lastStored: StoredEvidence | null = null;
  const evidenceStore: GptEvidenceStorePort = {
    appendRecord: async (input) => {
      const existing = storedByKey.get(input.idempotencyKey);
      if (existing) return JSON.stringify(existing.record.payload) === JSON.stringify(input.recordPayload)
        ? { status: "success", recordRef: existing.recordRef } : { status: "failed" };
      const recordRef = input.idempotencyKey.startsWith("gpt-call-terminal-evidence:v1:")
        ? "record:gpt-terminal-readback" : "record:gpt-failed-readback";
      const stored = Object.freeze({ recordRef, record: Object.freeze({
        missionId: input.missionId, runId: input.runId, stepId: input.stepId,
        sourceAbilityGroupId: input.sourceCapabilityId,
        sourceChildCapabilityId: input.sourceChildCapabilityId,
        idempotencyKey: input.idempotencyKey, payload: input.recordPayload,
        artifactRefs: Object.freeze([...(input.artifactRefs ?? [])]),
      }) });
      storedByKey.set(input.idempotencyKey, stored);
      storedByRef.set(recordRef, stored);
      lastStored = stored;
      return { status: "success", recordRef };
    },
    appendArtifact: async (input) => {
      if (!options.storeArtifacts || input.content === undefined) return { status: "failed" };
      const content = typeof input.content === "string" ? new TextEncoder().encode(input.content) : new Uint8Array(input.content);
      const artifactRef = `artifact:gpt-acceptance:${artifactsByRef.size + 1}`;
      artifactsByRef.set(artifactRef, Object.freeze({ content,
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        integrityHash: `sha256:${createHash("sha256").update(content).digest("hex")}` }));
      return { status: "success", artifactRef };
    },
    readRecordRef: async (input) => storedByRef.has(input.recordRef)
      ? { status: "success", recordRef: input.recordRef, record: storedByRef.get(input.recordRef)!.record }
      : { status: "failed" },
    readArtifactRef: async (input) => artifactsByRef.has(input.artifactRef)
      ? { status: "success", artifactRef: input.artifactRef, artifact: artifactsByRef.get(input.artifactRef) }
      : { status: "failed" },
    readExactCallEvidence: async (input) => storedByKey.get(`gpt-call-terminal-evidence:v1:${input.exactCallIdentityHash}`)
      ?? storedByKey.get(`gpt-call-evidence:v1:${input.exactCallIdentityHash}`) ?? null,
  };
  return Object.freeze({ evidenceStore, stored: () => lastStored, recordCount: () => storedByKey.size,
    recordKeys: () => Object.freeze([...storedByKey.keys()]),
    tamperLastPayload: (payload: Readonly<Record<string, unknown>>): void => {
      if (!lastStored) throw new Error("EVIDENCE_TEST_RECORD_MISSING");
      const key = String(lastStored.record.idempotencyKey);
      const replacement = Object.freeze({ recordRef: lastStored.recordRef,
        record: Object.freeze({ ...lastStored.record, payload }) });
      storedByKey.set(key, replacement); storedByRef.set(replacement.recordRef, replacement); lastStored = replacement;
    } });
};

export const acceptanceIntentFor = <K extends GptChildCapabilityId>(
  result: GptChildCapabilityResult<K>, input: GptChildInputMap[K],
): GptChildCapabilityIntent<K> => {
  const proof = result.proof;
  return Object.freeze({ childCapabilityId: proof.childCapabilityId as K,
    executionId: proof.executionId, jobId: proof.jobId, attemptId: proof.attemptId,
    pluginId: proof.pluginId, pluginVersion: proof.pluginVersion,
    productStepId: proof.productStepId, callId: proof.callId, inputHash: proof.inputHash,
    actionOrdinal: proof.actionOrdinal, input }) as GptChildCapabilityIntent<K>;
};
