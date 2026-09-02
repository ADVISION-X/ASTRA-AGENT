import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { executionFailure } from "../../typed-failure.js";

type CheckpointEvidenceIdentity = Readonly<{
  source_attempt_id: string;
  evidence_ref: string;
  evidence_hash: `sha256:${string}`;
}>;

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const storedIdentityValid = (input: Readonly<{
  stored: NonNullable<Awaited<ReturnType<ForensicsPersistenceAbilityGroup["readRecordRef"]>>["record"]>;
  evidenceJobId: string;
  checkpoint: CheckpointEvidenceIdentity;
  childCapabilityId: "checkpoint_gpt_text_response" | "checkpoint_gpt_generated_image";
  initialKey: string;
  terminalKey: string;
}>): boolean => input.stored.missionId === input.evidenceJobId
  && input.stored.runId === input.checkpoint.source_attempt_id
  && Boolean(input.stored.stepId)
  && input.stored.sourceAbilityGroupId === "gpt"
  && input.stored.sourceChildCapabilityId === input.childCapabilityId
  && (input.stored.idempotencyKey === input.initialKey
    || input.stored.idempotencyKey === input.terminalKey);

const payloadIdentityValid = (input: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  checkpoint: CheckpointEvidenceIdentity;
  pluginVersion: number;
}>): boolean => input.payload.plugin_version === input.pluginVersion
  && Number.isSafeInteger(input.payload.action_ordinal)
  && Number(input.payload.action_ordinal) > 0
  && input.payload.result_status === "success"
  && input.payload.postcondition_result === "passed"
  && input.payload.failure_code === null
  && input.payload.committed_mutation === "no"
  && input.payload.source_evidence_hash === input.checkpoint.evidence_hash;

const artifactRefsValid = (
  refs: unknown,
  expectedPrefix: readonly string[],
  expectedCount: number,
): refs is readonly string[] => Array.isArray(refs)
  && refs.length === expectedCount
  && expectedPrefix.every((value, index) => refs[index] === value);

export const readContinuationCheckpointEvidence = async (input: Readonly<{
  evidenceStore: ForensicsPersistenceAbilityGroup;
  evidenceJobId: string;
  pluginVersion: number;
  checkpoint: CheckpointEvidenceIdentity;
  childCapabilityId: "checkpoint_gpt_text_response" | "checkpoint_gpt_generated_image";
  expectedArtifactRefPrefix: readonly string[];
  expectedArtifactCount: number;
}>): Promise<readonly string[]> => {
  const evidence = await input.evidenceStore.readRecordRef({
    childCapabilityId: "read-record-ref",
    recordRef: input.checkpoint.evidence_ref,
  });
  const stored = evidence.record;
  const payload = record(stored?.payload);
  const exactCallIdentityHash = payload?.exact_call_identity_hash;
  const artifactRefs = stored?.artifactRefs;
  const initialKey = `gpt-call-evidence:v1:${String(exactCallIdentityHash)}`;
  const terminalKey = `gpt-call-terminal-evidence:v1:${String(exactCallIdentityHash)}`;
  if (evidence.status !== "success" || evidence.recordRef !== input.checkpoint.evidence_ref
    || !stored
    || !payload || typeof exactCallIdentityHash !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(exactCallIdentityHash)
    || !storedIdentityValid({ ...input, stored, initialKey, terminalKey })
    || !payloadIdentityValid({ ...input, payload })
    || !artifactRefsValid(artifactRefs, input.expectedArtifactRefPrefix, input.expectedArtifactCount)) {
    throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_EVIDENCE_INVALID");
  }
  return Object.freeze([...artifactRefs]);
};
