import type { GptProductionExecutionInput } from "../../../capabilities/gpt/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, sha256 } from "./contracts.js";
import type { ProductionRuntimeStore } from "./store.js";

type Checkpoint = Parameters<NonNullable<GptProductionExecutionInput["recordSettledCheckpoint"]>>[0];

export const recordSourceCheckpoint = (input: Readonly<{
  store: ProductionRuntimeStore; browserAuthority: WorkbenchBrowserAuthority;
  jobId: string; attemptId: string; checkpoint: Checkpoint;
}>): void => {
  const checkpoint = input.checkpoint;
  const history = input.browserAuthority.readJobBrowserHistoryEvidence(input.jobId);
  const effects = history.replayEffects.filter((effect) =>
    effect.effectIdentityHash === checkpoint.providerEffectIdentityHash
    && effect.attemptId === checkpoint.sourceAttemptId
    && effect.resultRevision === checkpoint.sourceResultRevision);
  if (!history.walHistoryVerified || effects.length !== 1) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_AMBIGUOUS");
  }
  const effect = effects[0]!;
  const expectedAuthorityHash = checkpoint.browserAuthorityRef
    === `browser-source:${checkpoint.providerEffectIdentityHash}`
    ? effect.walAuthorityHash : effect.rawWalAuthorityHash;
  if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
    || effect.physicalInputCount !== 1 || effect.anchorState !== "trusted"
    || !effect.canonicalConversationHash || !effect.userTurnHash
    || expectedAuthorityHash !== checkpoint.browserAuthorityHash
    || effect.canonicalConversationHash !== sha256(Buffer.from(
      checkpoint.canonicalConversationUrl, "utf8"))
    || effect.userTurnHash !== sha256(Buffer.from(checkpoint.userTurnId, "utf8"))) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_IDENTITY_MISMATCH");
  }
  const body = Object.freeze({
    kind: "settled_checkpoint" as const, path: "source_checkpoint" as const,
    effect_identity_hash: effect.effectIdentityHash,
    source_effect_set_hash: effect.sourceEffectSetHash,
    wal_authority_hash: effect.walAuthorityHash,
    provider_input_delta: 0 as const,
    source_attempt_id: checkpoint.sourceAttemptId,
    source_result_revision: checkpoint.sourceResultRevision,
    checkpoint_exact_call_identity_hash: checkpoint.checkpointExactCallIdentityHash,
    artifact_ref: checkpoint.artifactRef,
    artifact_content_hash: checkpoint.artifactContentHash,
    submit_prompt_hash: checkpoint.submitPromptHash,
    canonical_conversation_hash: effect.canonicalConversationHash,
    user_turn_hash: effect.userTurnHash,
  });
  input.store.recordSourceReadbackObservation(input.jobId,
    input.attemptId, {
      ...body, proof_hash: hashCanonical(body), observed_at: new Date().toISOString(),
    });
};
