import { createHash } from "node:crypto";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptHash, ProductGptChildCapabilityId } from "./contract.js";
import type { GptProductionExecutionInput, GptEvidenceStorePort,
  GptProductionBrowserAuthority } from "./production-ports.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { imageResponseFromEvidence, readPersistedGptImageEvidence,
  readPersistedGptTextResponse } from "./evidence-artifacts.js";

type ExecutionInput = GptProductionExecutionInput;
type SourceCall = NonNullable<ExecutionInput["sourceReusableCalls"]>[number];
type ConfirmedSubmitCall = ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>;
type PendingSource = Readonly<{ key: string; source: SourceCall;
  canonicalConversationUrl: string; userTurnId: string }>;
export const productionCallKey = (call: Readonly<{ productStepId: string; callId: string;
  childCapabilityId: string }>): string =>
  [call.productStepId, call.callId, call.childCapabilityId].join("\u0000");

/** Reuses a Website-authorized historical submit and its exact checkpoint without new input. */
export class ProductionGptSourceReuse {
  public readonly calls: Map<string, SourceCall>;
  private readonly completedKeys = new Set<string>();
  private readonly pendingByStep = new Map<string, PendingSource>();

  public constructor(
    private readonly input: ExecutionInput,
    private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority,
  ) {
    this.calls = new Map((input.sourceReusableCalls ?? []).map((call) =>
      [productionCallKey(call), call]));
    if (this.calls.size !== (input.sourceReusableCalls?.length ?? 0)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_AUTHORITY_INVALID");
    }
  }

  public get hasPending(): boolean { return this.calls.size > this.completedKeys.size; }
  public get size(): number { return this.calls.size; }
  public pendingForStep(productStepId: string): SourceCall | undefined {
    return [...this.calls.entries()].find(([key, source]) =>
      source.productStepId === productStepId && !this.completedKeys.has(key))?.[1];
  }
  public hasPendingStep(productStepId: string): boolean {
    return [...this.calls.entries()].some(([key, source]) =>
      source.productStepId === productStepId && !this.completedKeys.has(key));
  }

  public readConfirmedSubmit(call: ConfirmedSubmitCall, recordIdentity: (identity: import("../../lib/browser/browser-authority-api.js").BrowserAtomicStepIdentity) => void): ProductGptChildResult<"submit_exact_gpt_turn_once"> | null {
    const key = productionCallKey({ productStepId: call.productStepId,
      callId: call.callId, childCapabilityId: call.child });
    const reusable = this.calls.get(key);
    if (!reusable) return null;
    if (this.completedKeys.has(key)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    const original = this.browserAuthority.readSourceConfirmedProviderEffect({
      jobId: this.input.jobId, sourceAttemptId: reusable.sourceAttemptId,
      sourceResultRevision: reusable.sourceResultRevision,
      productStepId: reusable.productStepId, callId: reusable.callId,
      childCapabilityId: reusable.childCapabilityId,
      effectIdentityHash: reusable.effectIdentityHash,
      walAuthorityHash: reusable.walAuthorityHash,
    });
    const locator = original.conversationLocator;
    const raw = original.terminalPayload;
    const value = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Readonly<Record<string, unknown>> : null;
    const digest = (text: string): GptHash =>
      `sha256:${createHash("sha256").update(text).digest("hex")}`;
    if (!value || original.actionOrdinal !== call.actionOrdinal
      || value.promptHash !== reusable.submitPromptHash
      || !locator
      || typeof value.userTurnId !== "string"
      || value.exactCallIdentityHash !== original.exactCallIdentityHash
      || value.rawCount !== 1 || value.eligibleCount !== 1
      || digest(locator.canonicalConversationUrl) !== reusable.canonicalConversationHash
      || digest(value.userTurnId) !== reusable.userTurnHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    recordIdentity(Object.freeze({ resultRevision: reusable.sourceResultRevision,
      productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child,
      actionOrdinal: original.actionOrdinal, inputHash: original.inputHash, replayPolicy: "provider-effect-once" }));
    const result = Object.freeze({
      value: Object.freeze({ status: "CONFIRMED" as const,
        promptHash: reusable.submitPromptHash, mutationSent: true as const,
        userTurnId: value.userTurnId }),
      evidenceRef: original.authorityRef, evidenceHash: original.authorityHash,
      sourceAttemptId: reusable.sourceAttemptId,
      exactCallIdentityHash: original.exactCallIdentityHash,
      artifactRefs: Object.freeze([]),
      effectReceipt: Object.freeze({
        effectScope: "provider_effect" as const,
        providerEffectIdentityHash: reusable.effectIdentityHash,
        outcome: "CONFIRMED" as const, mutationOutcome: "confirmed" as const,
        terminalAt: original.terminalAt,
        evidenceRef: original.authorityRef, evidenceHash: original.authorityHash,
      }),
    });
    this.pendingByStep.set(`${call.sessionKey}\u0000${call.productStepId}`,
      Object.freeze({ key, source: reusable, canonicalConversationUrl: locator!.canonicalConversationUrl,
        userTurnId: value.userTurnId }));
    return result;
  }

  public async recoverCheckpoint<K extends ProductGptChildCapabilityId>(
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    source: SourceCall,
  ): Promise<ProductGptChildResult<K>> {
    if (call.child !== "checkpoint_gpt_text_response"
      && call.child !== "checkpoint_gpt_generated_image") {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_READBACK_ONLY");
    }
    const stepKey = `${call.sessionKey}\u0000${call.productStepId}`;
    const pending = this.pendingByStep.get(stepKey);
    const checkpointInput = call.input as Readonly<{
      canonicalConversationUrl: string; userTurnId: string; turnMarker?: string;
    }>;
    if (!pending || pending.source !== source
      || pending.canonicalConversationUrl !== checkpointInput.canonicalConversationUrl
      || pending.userTurnId !== checkpointInput.userTurnId) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    const identity = { evidenceStore: this.evidenceStore, jobId: this.input.jobId,
      attemptId: source.sourceAttemptId,
      exactCallIdentityHash: source.checkpointExactCallIdentityHash };
    const image = call.child === "checkpoint_gpt_generated_image"
      ? await readPersistedGptImageEvidence(identity) : null;
    const text = call.child === "checkpoint_gpt_text_response"
      ? await readPersistedGptTextResponse(identity) : null;
    const recovered = image ?? text;
    if (!recovered || recovered.artifactRef !== source.artifactRef
      || recovered.integrityHash !== source.artifactContentHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
    }
    const value = image
      ? imageResponseFromEvidence(image, {
        canonicalConversationUrl: checkpointInput.canonicalConversationUrl,
        userTurnId: checkpointInput.userTurnId,
        turnMarker: checkpointInput.turnMarker ?? "",
      }) : text!.value;
    const reused = Object.freeze({
      value, evidenceRef: recovered.artifactRef, evidenceHash: recovered.integrityHash,
      sourceAttemptId: source.sourceAttemptId,
      exactCallIdentityHash: source.checkpointExactCallIdentityHash,
      artifactRefs: Object.freeze([image?.originalArtifactRef ?? recovered.artifactRef]),
      effectReceipt: null,
    }) as ProductGptChildResult<K>;
    this.input.recordSettledCheckpoint?.(Object.freeze({
      providerEffectIdentityHash: source.effectIdentityHash,
      browserAuthorityHash: source.walAuthorityHash,
      browserAuthorityRef: `browser-source:${source.effectIdentityHash}`,
      sourceAttemptId: source.sourceAttemptId,
      sourceResultRevision: source.sourceResultRevision,
      checkpointExactCallIdentityHash: source.checkpointExactCallIdentityHash,
      artifactRef: source.artifactRef, artifactContentHash: source.artifactContentHash,
      submitPromptHash: source.submitPromptHash,
      canonicalConversationUrl: pending.canonicalConversationUrl,
      userTurnId: pending.userTurnId,
    }));
    this.pendingByStep.delete(stepKey);
    this.completedKeys.add(pending.key);
    return reused;
  }
}
