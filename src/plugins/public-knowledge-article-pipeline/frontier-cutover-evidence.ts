import { gptExactCallIdentityHash } from "../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { hashCanonical, type WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { executionFailure } from "../../lib/typed-failure.js";
import { PLUGIN_ID } from "./seo-turn-contract.js";

type TextCheckpointInput = Readonly<{
  assistantTurnId: string;
  canonicalConversationUrl: string;
  expectedPromptHash: `sha256:${string}`;
  expectedResponseHash: `sha256:${string}`;
  turnMarker: string;
}>;

const payloadRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const recordIdentityValid = (input: Readonly<{
  record: NonNullable<Awaited<ReturnType<ForensicsPersistenceAbilityGroup["readExactCallEvidence"]>>>["record"];
  task: WebsiteAgentTask;
  sourceAttemptId: string;
  stepId: string;
  exactCallIdentityHash: `sha256:${string}`;
}>): boolean => input.record.missionId === input.task.job_id
  && input.record.runId === input.sourceAttemptId
  && input.record.stepId === input.stepId
  && input.record.sourceAbilityGroupId === "gpt"
  && input.record.sourceChildCapabilityId === "checkpoint_gpt_text_response"
  && input.record.idempotencyKey === `gpt-call-evidence:v1:${input.exactCallIdentityHash}`;

const payloadIdentityValid = (input: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  exactCallIdentityHash: `sha256:${string}`;
  actionOrdinal: number;
  pluginVersion: number;
}>): boolean => input.payload.exact_call_identity_hash === input.exactCallIdentityHash
  && input.payload.action_ordinal === input.actionOrdinal
  && input.payload.plugin_version === input.pluginVersion
  && input.payload.result_status === "success"
  && input.payload.postcondition_result === "passed"
  && input.payload.failure_code === null
  && input.payload.committed_mutation === "no"
  && typeof input.payload.source_evidence_hash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(input.payload.source_evidence_hash);

export const readCutoverTextEvidence = async (input: Readonly<{
  evidenceStore: ForensicsPersistenceAbilityGroup;
  task: WebsiteAgentTask;
  pluginVersion: number;
  sourceAttemptId: string;
  stepId: "corpus_research" | "article_synthesis";
  actionOrdinal: 15 | 30;
  checkpointInput: TextCheckpointInput;
  expectedEvidenceRef?: string;
  expectedEvidenceHash?: `sha256:${string}`;
  expectedArtifactRef?: string;
}>): Promise<Readonly<{
  artifactRef: string;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
}>> => {
  const identity = Object.freeze({
    jobId: input.task.job_id,
    attemptId: input.sourceAttemptId,
    pluginId: PLUGIN_ID,
    pluginVersion: input.pluginVersion,
    productStepId: input.stepId,
    callId: "text-checkpoint",
    childCapabilityId: "checkpoint_gpt_text_response" as const,
    inputHash: hashCanonical(input.checkpointInput),
  });
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const evidence = await input.evidenceStore.readExactCallEvidence({
    missionId: input.task.job_id,
    runId: input.sourceAttemptId,
    exactCallIdentityHash,
  });
  const payload = payloadRecord(evidence?.record.payload);
  const refs = evidence?.record.artifactRefs;
  if (!evidence || !payload
    || !recordIdentityValid({ ...input, record: evidence.record, exactCallIdentityHash })
    || !payloadIdentityValid({ ...input, payload, exactCallIdentityHash })
    || !Array.isArray(refs) || refs.length !== 1 || typeof refs[0] !== "string"
    || (input.expectedEvidenceRef !== undefined && evidence.recordRef !== input.expectedEvidenceRef)
    || (input.expectedEvidenceHash !== undefined
      && payload.source_evidence_hash !== input.expectedEvidenceHash)
    || (input.expectedArtifactRef !== undefined && refs[0] !== input.expectedArtifactRef)) {
    throw executionFailure("failed", "GPT_CONTINUATION_CUTOVER_ARTIFACT_UNRESOLVED");
  }
  return Object.freeze({
    artifactRef: refs[0],
    evidenceRef: evidence.recordRef,
    evidenceHash: payload.source_evidence_hash as `sha256:${string}`,
  });
};
