import {
  gptContinuationIdentityHash,
  gptExactCallIdentityHash,
  type GptChildCapabilityIntent,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { executionFailure } from "../../typed-failure.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import type { ProductionHash } from "./contracts.js";
import type { ExactGptCallFacts } from "./plugin.js";
import type { ProductionRuntimeStore } from "./store.js";

type FactReader = Readonly<{
  browserAuthority: WorkbenchBrowserAuthority;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  store: ProductionRuntimeStore;
}>;

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const stringArray = (value: unknown): readonly string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    ? Object.freeze([...value]) as readonly string[] : null;

const readEvidence = async (
  reader: FactReader,
  intent: GptChildCapabilityIntent,
  exactCallIdentityHash: `sha256:${string}`,
): Promise<ExactGptCallFacts["evidence"]> => {
  const storedEvidence = await reader.evidenceStore.readExactCallEvidence({
    missionId: intent.jobId, runId: intent.attemptId, exactCallIdentityHash,
  });
  if (!storedEvidence) return null;
  const evidenceRecord = storedEvidence.record;
  const payload = record(evidenceRecord.payload);
  const artifactRefs = stringArray(evidenceRecord.artifactRefs ?? []);
  const evidenceHash = payload?.source_evidence_hash;
  if (evidenceRecord.missionId !== intent.jobId
    || evidenceRecord.runId !== intent.attemptId
    || evidenceRecord.stepId !== intent.productStepId
    || evidenceRecord.sourceAbilityGroupId !== "gpt"
    || evidenceRecord.sourceChildCapabilityId !== intent.childCapabilityId
    || evidenceRecord.idempotencyKey !== `gpt-call-evidence:v1:${exactCallIdentityHash}`
    || payload?.exact_call_identity_hash !== exactCallIdentityHash
    || payload?.action_ordinal !== intent.actionOrdinal
    || payload?.plugin_version !== intent.pluginVersion
    || typeof evidenceHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(evidenceHash)
    || artifactRefs === null) {
    throw executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID");
  }
  return Object.freeze({
    owner: "forensics-persistence", evidenceRef: storedEvidence.recordRef,
    evidenceHash: evidenceHash as ProductionHash, readbackVerified: true, artifactRefs,
  });
};

const continuationRefFromIntent = (intent: GptChildCapabilityIntent): string | null => {
  if (intent.childCapabilityId === "persist_gpt_continuation") {
    return `gpt-continuation:${gptExactCallIdentityHash(intent).slice(7)}`;
  }
  if (typeof intent.input.continuationRef === "string" && intent.input.continuationRef.length > 0) {
    return intent.input.continuationRef;
  }
  const lane = record(intent.input.lane);
  return typeof lane?.continuation_ref === "string" && lane.continuation_ref.length > 0
    ? lane.continuation_ref : null;
};

const readContinuation = (
  reader: FactReader,
  intent: GptChildCapabilityIntent,
): ExactGptCallFacts["continuation"] => {
  const continuationRef = continuationRefFromIntent(intent);
  if (!continuationRef) return null;
  const stored = reader.store.readGptContinuation(continuationRef);
  if (!stored) return null;
  if (stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
    throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
  }
  return Object.freeze({
    owner: "gpt-session-controller", continuationRef,
    conversationIdentityHash: stored.conversation_identity_hash, laneVersion: stored.lane_version,
    priorPromptHash: stored.provider.prior_prompt_hash,
    priorResponseHash: stored.provider.prior_raw_output_hash, contentReadbackVerified: true,
  });
};

export const readProductionGptCallFacts = async (
  reader: FactReader,
  intent: GptChildCapabilityIntent,
): Promise<ExactGptCallFacts> => {
  const exactCallIdentityHash = gptExactCallIdentityHash(intent);
  const mutation = reader.browserAuthority.readExactCallMutationFact({
    jobId: intent.jobId, attemptId: intent.attemptId, ownerPluginId: intent.pluginId,
    pluginVersion: intent.pluginVersion, exactCallIdentityHash, actionOrdinal: intent.actionOrdinal,
  });
  return Object.freeze({
    exactCallIdentityHash,
    mutation: mutation ? Object.freeze({ owner: "browser", effectScope: mutation.effectScope,
      outcome: mutation.outcome, terminalAt: mutation.terminalAt }) : null,
    evidence: await readEvidence(reader, intent, exactCallIdentityHash),
    continuation: readContinuation(reader, intent),
  });
};
