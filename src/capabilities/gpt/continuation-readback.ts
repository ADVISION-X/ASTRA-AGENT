import { createHash } from "node:crypto";

import { gptContinuationIdentityHash } from "./schema.js";
import {
  gptContinuationUsable,
  type GptContinuationGeneratedImageCheckpoint,
  type GptContinuationOriginCheckpoint,
  type GptContinuationTextCheckpoint,
  type StoredGptContinuation,
} from "./session/gpt-continuation-store-port.js";
import type { GptContinuationLane } from "./session/gpt-session-controller.js";
import type {
  ExactGptContinuationQuery,
  ExactGptContinuationReadback,
  ExactGptTextCheckpointReadback,
} from "./product-api.js";
import type { ForensicsPersistenceAbilityGroup } from "../forensics-persistence/index.js";
import { executionFailure } from "../../lib/execution-failure.js";
import {
  readGeneratedImageCheckpointArtifacts,
  readTextCheckpointArtifact,
} from "./artifact-reader.js";
import { readContinuationCheckpointEvidence } from "./continuation-evidence.js";

export type GptContinuationReadbackExecution = Readonly<{
  jobId: string;
  continuationRef: string | null;
  ownerRef: string;
  subjectRef: string;
  authorizationRef: string;
  pluginId: string;
  pluginVersion: number;
}>;
export interface GptContinuationReadbackPort {
  readGptContinuation(continuationRef: string): StoredGptContinuation | null;
  readGptContinuationForOriginJob(
    jobId: string,
    pluginId: string,
    turnMarker: string,
  ): StoredGptContinuation | null;
  readGptContinuationForFrontier(frontierRef: `sha256:${string}`): StoredGptContinuation | null;
  readTaskPluginVersion(jobId: string): number | null;
}
type FrontierQuery = Extract<ExactGptContinuationQuery, { lookupKind: "frontier_ref" }>;
type FrontierReadback = Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>;
type StoredFrontier = StoredGptContinuation;
type FrontierContext = Readonly<{
  stored: StoredFrontier;
  originPluginVersion: number;
  currentPluginVersion: number;
}>;

const hashCanonical = (value: unknown): `sha256:${string}` => {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
    return typeof input === "string" ? input.normalize("NFC") : input;
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
};

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
  stored: StoredGptContinuation,
): boolean => Boolean(stored.origin_checkpoint)
  && Boolean(stored.current_checkpoint)
  && stored.origin_provider.prior_task_id === stored.origin_job_id
  && stored.origin_provider.provider_page_url === stored.origin_checkpoint!.canonical_conversation_url
  && stored.origin_provider.prior_prompt_hash === stored.origin_checkpoint!.prompt_hash
  && stored.origin_provider.prior_raw_output_hash === stored.origin_checkpoint!.semantic_text_hash
  && stored.origin_provider.prior_turn_marker === stored.origin_checkpoint!.turn_marker;

const currentBindingMatches = (
  stored: StoredGptContinuation,
): boolean => {
  const current = stored.current_checkpoint!;
  const currentHash = current.checkpoint_kind === "text" ? current.semantic_text_hash : current.media_hash;
  return stored.provider.provider_page_url === current.canonical_conversation_url
    && stored.provider.prior_prompt_hash === current.prompt_hash
    && stored.provider.prior_raw_output_hash === currentHash
    && stored.provider.prior_turn_marker === current.turn_marker;
};

export class GptContinuationReadback {
  public constructor(
    private readonly evidenceStore: ForensicsPersistenceAbilityGroup,
    private readonly store: GptContinuationReadbackPort,
  ) {}

  private verifiedLane(
    stored: StoredGptContinuation | null,
    input: GptContinuationReadbackExecution,
  ): GptContinuationLane | null {
    if (!stored) return null;
    if (stored.origin_job_id !== input.jobId
      || stored.plugin_id !== input.pluginId
      || stored.owner_ref !== input.ownerRef
      || stored.subject_ref !== input.subjectRef
      || stored.authorization_ref !== input.authorizationRef
      || stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
    }
    return Object.freeze({
      continuation_ref: stored.continuation_ref,
      lane_version: stored.lane_version,
      provider: stored.provider,
    });
  }

  private continuationForTurn(input: GptContinuationReadbackExecution, turnMarker: string): GptContinuationLane | null {
    if (!turnMarker) throw executionFailure("failed", "GPT_CONTINUATION_TURN_MARKER_INVALID");
    const stored = input.continuationRef
      ? this.store.readGptContinuation(input.continuationRef)
      : this.store.readGptContinuationForOriginJob(input.jobId, input.pluginId, turnMarker);
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

  private frontierContext(input: GptContinuationReadbackExecution, query: FrontierQuery): FrontierContext | null {
    if (!/^sha256:[a-f0-9]{64}$/u.test(query.frontierRef)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_INVALID");
    }
    const stored = this.store.readGptContinuationForFrontier(query.frontierRef);
    if (!stored) return null;
    if (!gptContinuationUsable(stored)
      || stored.owner_ref !== input.ownerRef
      || stored.subject_ref !== input.subjectRef
      || stored.frontier_ref !== query.frontierRef
      || !originBindingMatches(stored)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    gptContinuationIdentityHash(stored.origin_provider);
    const originPluginVersion = this.store.readTaskPluginVersion(stored.origin_provider.prior_task_id);
    const currentPluginVersion = this.store.readTaskPluginVersion(stored.provider.prior_task_id);
    if (originPluginVersion === null || currentPluginVersion === null
      || originPluginVersion !== stored.origin_plugin_version) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    return { stored, originPluginVersion, currentPluginVersion };
  }

  private authorizationReadback(
    input: GptContinuationReadbackExecution,
    query: FrontierQuery,
    stored: StoredFrontier,
  ): FrontierReadback["authorizationReadback"] {
    if (query.authorization.kind === "origin_authorization") {
      if (query.authorization.originAuthorizationRef !== stored.authorization_ref
        || stored.origin_job_id !== input.jobId
        || stored.plugin_id !== input.pluginId
        || stored.origin_plugin_version !== input.pluginVersion
        || stored.authorization_ref !== input.authorizationRef) {
        throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_AUTHORIZATION_INVALID");
      }
      return Object.freeze({
        kind: "origin_authorization",
        originAuthorizationRef: stored.authorization_ref,
      });
    }
    const origin = stored.origin_checkpoint!;
    const sourceCheckpointRef = stored.source_checkpoint_hash ?? hashCanonical(origin);
    if (query.authorization.currentAuthorizationRef !== input.authorizationRef
      || query.authorization.opaqueReadGrantHash !== stored.opaque_read_grant_hash
      || !stored.artifact_ref || !stored.artifact_hash
      || stored.artifact_ref !== origin.artifact_ref
      || stored.artifact_hash !== origin.semantic_text_hash
      || !stored.semantic_admission_receipt_ref || !stored.semantic_admission_receipt_hash) {
      throw executionFailure("failed", "GPT_CONTINUATION_ARTIFACT_READ_GRANT_INVALID");
    }
    return Object.freeze({
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

  private async checkpointReadback(context: FrontierContext): Promise<Readonly<{
    originCheckpoint: FrontierReadback["originCheckpoint"];
    currentCheckpoint: FrontierReadback["currentCheckpoint"];
  }>> {
    const origin = context.stored.origin_checkpoint!;
    const current = context.stored.current_checkpoint!;
    const originCheckpoint = await this.readTextCheckpoint(
      origin, context.stored.origin_provider.prior_task_id, context.originPluginVersion,
    );
    const currentCheckpoint = current.checkpoint_kind === "text"
      ? await this.readTextCheckpoint(
        current, context.stored.provider.prior_task_id, context.currentPluginVersion,
      )
      : await this.readImageCheckpoint(
        current, context.stored.provider.prior_task_id, context.currentPluginVersion,
      );
    if (!currentBindingMatches(context.stored)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_IDENTITY_INVALID");
    }
    return { originCheckpoint, currentCheckpoint };
  }

  public async readExact(
    input: GptContinuationReadbackExecution,
    query: ExactGptContinuationQuery,
  ): Promise<ExactGptContinuationReadback | null> {
    if (query.lookupKind === "turn_marker") {
      const lane = this.continuationForTurn(input, query.turnMarker);
      return lane ? Object.freeze({ lookupKind: "turn_marker", lane }) : null;
    }
    const context = this.frontierContext(input, query);
    if (!context) return null;
    const authorizationReadback = this.authorizationReadback(input, query, context.stored);
    const { originCheckpoint, currentCheckpoint } = await this.checkpointReadback(context);
    return Object.freeze({
      lookupKind: "frontier_ref", continuationRef: context.stored.continuation_ref,
      authorizationReadback,
      originProvider: context.stored.origin_provider, originCheckpoint,
      currentProvider: context.stored.provider, currentCheckpoint,
    });
  }
}
