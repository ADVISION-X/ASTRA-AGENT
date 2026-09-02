import {
  gptContinuationIdentityHash,
  gptContinuationUsable,
  type GptContinuationGeneratedImageCheckpoint,
  type GptContinuationLane,
  type GptContinuationOriginCheckpoint,
  type GptContinuationTextCheckpoint,
} from "../../../capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { executionFailure } from "../../typed-failure.js";
import { hashCanonical, type WebsiteAgentTask } from "./contracts.js";
import {
  readGeneratedImageCheckpointArtifacts,
  readTextCheckpointArtifact,
} from "./gpt-artifact-reader.js";
import { readContinuationCheckpointEvidence } from "./production-gpt-continuation-evidence.js";
import type {
  ExactGptContinuationQuery,
  ExactGptContinuationReadback,
  ExactGptTextCheckpointReadback,
} from "./plugin.js";
import { ProductionRuntimeStore } from "./store.js";

type ReadbackExecution = Readonly<{ task: WebsiteAgentTask; pluginId: string; pluginVersion: number }>;

const imageArtifactMatches = (
  artifacts: Awaited<ReturnType<typeof readGeneratedImageCheckpointArtifacts>>,
  checkpoint: GptContinuationGeneratedImageCheckpoint,
): boolean => artifacts.assistantTurnId === checkpoint.assistant_turn_id
  && artifacts.mediaHash === checkpoint.media_hash
  && artifacts.canonicalConversationUrl === checkpoint.canonical_conversation_url
  && artifacts.promptHash === checkpoint.prompt_hash
  && artifacts.turnMarker === checkpoint.turn_marker
  && artifacts.originalSha256 === checkpoint.original_sha256
  && artifacts.originalBytes.byteLength === checkpoint.original_bytes
  && artifacts.originalMediaType === checkpoint.original_media_type
  && artifacts.originalWidth === checkpoint.original_width
  && artifacts.originalHeight === checkpoint.original_height
  && artifacts.sha256 === checkpoint.webp_sha256
  && artifacts.webpBytes.byteLength === checkpoint.webp_bytes;

const predecessorMatches = (
  predecessor: ExactGptTextCheckpointReadback,
  checkpoint: GptContinuationGeneratedImageCheckpoint,
): boolean => {
  const imageOrdinal = Number(/^conversation-turn-([1-9][0-9]*)$/u.exec(checkpoint.assistant_turn_id)?.[1]);
  const predecessorOrdinal = Number(/^conversation-turn-([1-9][0-9]*)$/u.exec(predecessor.assistantTurnId)?.[1]);
  return Number.isSafeInteger(imageOrdinal) && Number.isSafeInteger(predecessorOrdinal)
    && predecessorOrdinal + 2 === imageOrdinal
    && predecessor.canonicalConversationUrl === checkpoint.canonical_conversation_url;
};

const originBindingMatches = (
  stored: NonNullable<ReturnType<ProductionRuntimeStore["readGptContinuationForFrontier"]>>,
): boolean => Boolean(stored.origin_checkpoint)
  && Boolean(stored.current_checkpoint)
  && stored.origin_provider.prior_task_id === stored.origin_job_id
  && stored.origin_provider.provider_page_url === stored.origin_checkpoint!.canonical_conversation_url
  && stored.origin_provider.prior_prompt_hash === stored.origin_checkpoint!.prompt_hash
  && stored.origin_provider.prior_raw_output_hash === stored.origin_checkpoint!.semantic_text_hash
  && stored.origin_provider.prior_turn_marker === stored.origin_checkpoint!.turn_marker;

const currentBindingMatches = (
  stored: NonNullable<ReturnType<ProductionRuntimeStore["readGptContinuationForFrontier"]>>,
): boolean => {
  const current = stored.current_checkpoint!;
  const currentHash = current.checkpoint_kind === "text" ? current.semantic_text_hash : current.media_hash;
  return stored.provider.provider_page_url === current.canonical_conversation_url
    && stored.provider.prior_prompt_hash === current.prompt_hash
    && stored.provider.prior_raw_output_hash === currentHash
    && stored.provider.prior_turn_marker === current.turn_marker;
};

export class ProductionGptContinuationReadback {
  public constructor(
    private readonly evidenceStore: ForensicsPersistenceAbilityGroup,
    private readonly store: ProductionRuntimeStore,
  ) {}

  private verifiedLane(
    stored: ReturnType<ProductionRuntimeStore["readGptContinuation"]>,
    input: ReadbackExecution,
  ): GptContinuationLane | null {
    if (!stored) return null;
    if (stored.origin_job_id !== input.task.job_id
      || stored.plugin_id !== input.pluginId
      || stored.owner_ref !== input.task.business_identity.owner_ref
      || stored.subject_ref !== input.task.business_identity.subject_ref
      || stored.authorization_ref !== input.task.business_identity.authorization_ref
      || stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
    }
    return Object.freeze({
      continuation_ref: stored.continuation_ref,
      lane_version: stored.lane_version,
      provider: stored.provider,
    });
  }

  private continuationForTurn(input: ReadbackExecution, turnMarker: string): GptContinuationLane | null {
    if (!turnMarker) throw executionFailure("failed", "GPT_CONTINUATION_TURN_MARKER_INVALID");
    const stored = input.task.continuation_ref
      ? this.store.readGptContinuation(input.task.continuation_ref)
      : this.store.readGptContinuationForOriginJob(input.task.job_id, input.pluginId, turnMarker);
    if (stored && stored.provider.prior_turn_marker !== turnMarker) return null;
    return this.verifiedLane(stored, input);
  }

  private async readTextCheckpoint(
    checkpoint: GptContinuationOriginCheckpoint | GptContinuationTextCheckpoint,
    evidenceJobId: string,
    pluginVersion: number,
  ): Promise<ExactGptTextCheckpointReadback> {
    const artifact = await readTextCheckpointArtifact(this.evidenceStore, checkpoint.artifact_ref);
    if (artifact.assistantTurnId !== checkpoint.assistant_turn_id
      || artifact.rawDomHash !== checkpoint.raw_dom_hash
      || artifact.semanticTextHash !== checkpoint.semantic_text_hash) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_ARTIFACT_INVALID");
    }
    await readContinuationCheckpointEvidence({
      evidenceStore: this.evidenceStore, evidenceJobId, pluginVersion,
      checkpoint, childCapabilityId: "checkpoint_gpt_text_response",
      expectedArtifactRefPrefix: [checkpoint.artifact_ref], expectedArtifactCount: 1,
    });
    return Object.freeze({
      checkpointKind: "text", sourceAttemptId: checkpoint.source_attempt_id,
      assistantTurnId: checkpoint.assistant_turn_id, artifactRef: checkpoint.artifact_ref,
      rawDomHtml: String(artifact.rawDomHtml), rawDomHash: checkpoint.raw_dom_hash,
      semanticText: String(artifact.semanticText), semanticTextHash: checkpoint.semantic_text_hash,
      canonicalConversationUrl: checkpoint.canonical_conversation_url, promptHash: checkpoint.prompt_hash,
      turnMarker: checkpoint.turn_marker, evidenceRef: checkpoint.evidence_ref,
      evidenceHash: checkpoint.evidence_hash,
    });
  }

  private async readImageCheckpoint(
    checkpoint: GptContinuationGeneratedImageCheckpoint,
    evidenceJobId: string,
    pluginVersion: number,
  ): Promise<Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>["currentCheckpoint"]> {
    const artifactRefs = await readContinuationCheckpointEvidence({
      evidenceStore: this.evidenceStore, evidenceJobId, pluginVersion,
      checkpoint, childCapabilityId: "checkpoint_gpt_generated_image",
      expectedArtifactRefPrefix: [checkpoint.original_artifact_ref, checkpoint.webp_artifact_ref],
      expectedArtifactCount: 3,
    });
    const artifacts = await readGeneratedImageCheckpointArtifacts(this.evidenceStore, artifactRefs);
    if (!imageArtifactMatches(artifacts, checkpoint)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_ARTIFACT_INVALID");
    }
    const predecessor = await this.readTextCheckpoint(
      checkpoint.predecessor_text_checkpoint, evidenceJobId, pluginVersion,
    );
    if (!predecessorMatches(predecessor, checkpoint)) {
      throw executionFailure("failed", "GPT_CONTINUATION_PREDECESSOR_INVALID");
    }
    return Object.freeze({
      checkpointKind: "generated_image", sourceAttemptId: checkpoint.source_attempt_id,
      assistantTurnId: checkpoint.assistant_turn_id,
      canonicalConversationUrl: checkpoint.canonical_conversation_url, promptHash: checkpoint.prompt_hash,
      mediaHash: checkpoint.media_hash, turnMarker: checkpoint.turn_marker,
      originalArtifactRef: checkpoint.original_artifact_ref, originalSha256: checkpoint.original_sha256,
      originalBytes: artifacts.originalBytes, originalMediaType: checkpoint.original_media_type,
      originalWidth: checkpoint.original_width, originalHeight: checkpoint.original_height,
      webpArtifactRef: checkpoint.webp_artifact_ref, webpSha256: checkpoint.webp_sha256,
      webpBytes: artifacts.webpBytes, mediaType: "image/webp", width: 1200, height: 630,
      evidenceRef: checkpoint.evidence_ref, evidenceHash: checkpoint.evidence_hash,
      predecessorTextCheckpoint: predecessor,
    });
  }

  public async readExact(
    input: ReadbackExecution,
    query: ExactGptContinuationQuery,
  ): Promise<ExactGptContinuationReadback | null> {
    if (query.lookupKind === "turn_marker") {
      const lane = this.continuationForTurn(input, query.turnMarker);
      return lane ? Object.freeze({ lookupKind: "turn_marker", lane }) : null;
    }
    if (!/^sha256:[a-f0-9]{64}$/u.test(query.frontierRef)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_INVALID");
    }
    const stored = this.store.readGptContinuationForFrontier(query.frontierRef);
    if (!stored) return null;
    if (!gptContinuationUsable(stored)
      || stored.owner_ref !== input.task.business_identity.owner_ref
      || stored.subject_ref !== input.task.business_identity.subject_ref) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    const origin = stored.origin_checkpoint;
    const current = stored.current_checkpoint;
    gptContinuationIdentityHash(stored.origin_provider);
    if (stored.frontier_ref !== query.frontierRef || !originBindingMatches(stored)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    const verifiedOrigin = origin!;
    const verifiedCurrent = current!;
    const originTask = this.store.readTask(stored.origin_provider.prior_task_id);
    const currentTask = this.store.readTask(stored.provider.prior_task_id);
    if (!originTask || !currentTask
      || originTask.identity.plugin_version !== stored.origin_plugin_version) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    let authorizationReadback: Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>["authorizationReadback"];
    if (query.authorization.kind === "origin_authorization") {
      if (query.authorization.originAuthorizationRef !== stored.authorization_ref
        || stored.origin_job_id !== input.task.job_id
        || stored.plugin_id !== input.pluginId
        || stored.origin_plugin_version !== input.pluginVersion
        || stored.authorization_ref !== input.task.business_identity.authorization_ref) {
        throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_AUTHORIZATION_INVALID");
      }
      authorizationReadback = Object.freeze({
        kind: "origin_authorization",
        originAuthorizationRef: stored.authorization_ref,
      });
    } else {
      const sourceCheckpointRef = stored.source_checkpoint_hash ?? hashCanonical(verifiedOrigin);
      if (query.authorization.currentAuthorizationRef !== input.task.business_identity.authorization_ref
        || query.authorization.opaqueReadGrantHash !== stored.opaque_read_grant_hash
        || !stored.artifact_ref || !stored.artifact_hash
        || stored.artifact_ref !== verifiedOrigin.artifact_ref
        || stored.artifact_hash !== verifiedOrigin.semantic_text_hash
        || !stored.semantic_admission_receipt_ref || !stored.semantic_admission_receipt_hash) {
        throw executionFailure("failed", "GPT_CONTINUATION_ARTIFACT_READ_GRANT_INVALID");
      }
      authorizationReadback = Object.freeze({
        kind: "current_artifact_read_grant",
        currentAuthorizationRef: query.authorization.currentAuthorizationRef,
        ownerScopeHash: hashCanonical({ kind: "gpt-owner-scope.v1", owner_ref: stored.owner_ref }),
        subjectRef: stored.subject_ref,
        sourceArtifactRef: stored.artifact_ref,
        sourceCheckpointRef,
        semanticAdmissionReceiptRef: stored.semantic_admission_receipt_ref,
        semanticAdmissionReceiptHash: stored.semantic_admission_receipt_hash,
        opaqueReadGrantHash: stored.opaque_read_grant_hash,
      });
    }
    const originCheckpoint = await this.readTextCheckpoint(
      verifiedOrigin, stored.origin_provider.prior_task_id, originTask.identity.plugin_version,
    );
    const currentCheckpoint = verifiedCurrent.checkpoint_kind === "text"
      ? await this.readTextCheckpoint(
        verifiedCurrent, stored.provider.prior_task_id, currentTask.identity.plugin_version,
      )
      : await this.readImageCheckpoint(
        verifiedCurrent, stored.provider.prior_task_id, currentTask.identity.plugin_version,
      );
    if (!currentBindingMatches(stored)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    return Object.freeze({
      lookupKind: "frontier_ref", continuationRef: stored.continuation_ref,
      authorizationReadback,
      originProvider: stored.origin_provider, originCheckpoint,
      currentProvider: stored.provider, currentCheckpoint,
    });
  }
}
