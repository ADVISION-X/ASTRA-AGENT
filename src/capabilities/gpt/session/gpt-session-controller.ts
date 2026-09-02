import { executionFailure } from "../../../lib/typed-failure.js";
import { createHash } from "node:crypto";
import { gptContinuationIdentityHash } from "../schema.js";

import type {
  GptContinuationStorePort,
  GptContinuationCheckpoint,
  GptContinuationFrontierBinding,
  GptContinuationCompletionInput,
  GptContinuationOriginCheckpoint,
  GptContinuationReservation,
  GptContinuationReservationReadback,
  GptProviderContinuation,
  StoredGptContinuation,
} from "./gpt-continuation-store-port.js";
import { gptContinuationUsable } from "./gpt-continuation-store-port.js";

export type AcquireGptContinuationLaneAuthorization =
  | Readonly<{ kind: "row_authorization"; currentAuthorizationRef: string }>
  | Readonly<{
      kind: "continuation_lane_use_grant";
      currentJobId: string;
      currentAuthorizationRef: string;
      opaqueLaneUseGrantHash: `sha256:${string}`;
    }>;

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => [key, canonicalValue(child)]));
};

const hashCanonical = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex")}`;

export interface GptContinuationLane {
  readonly continuation_ref: string;
  readonly lane_version: number;
  readonly provider: GptProviderContinuation;
}

const sameProvider = (left: GptProviderContinuation, right: GptProviderContinuation): boolean =>
  gptContinuationIdentityHash(left) === gptContinuationIdentityHash(right)
  && left.provider_page_url === right.provider_page_url
  && left.prior_task_id === right.prior_task_id
  && left.prior_prompt_hash === right.prior_prompt_hash
  && left.prior_raw_output_hash === right.prior_raw_output_hash
  && left.prior_turn_marker === right.prior_turn_marker;

const canonicalCheckpointObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalCheckpointObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => [key, canonicalCheckpointObject(child)]));
};

const canonicalCheckpointValue = (value: unknown): string =>
  JSON.stringify(canonicalCheckpointObject(value));

const sameOriginCheckpoint = (
  left: GptContinuationOriginCheckpoint | null,
  right: GptContinuationOriginCheckpoint | null,
): boolean => canonicalCheckpointValue(left) === canonicalCheckpointValue(right);

const sameCurrentCheckpoint = (
  left: GptContinuationCheckpoint | null,
  right: GptContinuationCheckpoint | null,
): boolean => canonicalCheckpointValue(left) === canonicalCheckpointValue(right);

const providerMatchesCheckpoint = (
  provider: GptProviderContinuation,
  checkpoint: GptContinuationCheckpoint | GptContinuationOriginCheckpoint,
  jobId: string,
): boolean => provider.prior_task_id === jobId
  && provider.provider_page_url === checkpoint.canonical_conversation_url
  && provider.prior_prompt_hash === checkpoint.prompt_hash
  && provider.prior_turn_marker === checkpoint.turn_marker
  && provider.prior_raw_output_hash === ("checkpoint_kind" in checkpoint
    && checkpoint.checkpoint_kind === "generated_image"
    ? checkpoint.media_hash : checkpoint.semantic_text_hash);

const originMatchesCurrent = (
  origin: GptContinuationOriginCheckpoint,
  current: GptContinuationCheckpoint,
): boolean => current.checkpoint_kind === "text"
  && canonicalCheckpointValue({ ...origin, checkpoint_kind: "text" })
    === canonicalCheckpointValue(current);

const imagePredecessorValid = (checkpoint: GptContinuationCheckpoint): boolean => {
  if (checkpoint.checkpoint_kind !== "generated_image") return true;
  const image = /^conversation-turn-([1-9][0-9]*)$/u.exec(checkpoint.assistant_turn_id);
  const predecessor = /^conversation-turn-([1-9][0-9]*)$/u.exec(
    checkpoint.predecessor_text_checkpoint.assistant_turn_id,
  );
  return checkpoint.predecessor_text_checkpoint.canonical_conversation_url
      === checkpoint.canonical_conversation_url
    && Number.isSafeInteger(Number(image?.[1]))
    && Number.isSafeInteger(Number(predecessor?.[1]))
    && Number(predecessor?.[1]) + 2 === Number(image?.[1]);
};

const assertProviderCheckpointPair = (
  provider: GptProviderContinuation,
  checkpoint: GptContinuationCheckpoint | GptContinuationOriginCheckpoint,
  jobId: string,
): void => {
  if (!providerMatchesCheckpoint(provider, checkpoint, jobId)
    || ("checkpoint_kind" in checkpoint && !imagePredecessorValid(checkpoint))) {
    throw executionFailure("failed", "GPT_CONTINUATION_PROVIDER_CHECKPOINT_MISMATCH");
  }
};

const samePersistedContent = (
  stored: StoredGptContinuation,
  input: Readonly<{
    jobId: string;
    pluginId: string;
    ownerRef: string;
    subjectRef: string;
    authorizationRef: string;
    provider: GptProviderContinuation;
    currentCheckpoint: GptContinuationCheckpoint;
    frontier: GptContinuationFrontierBinding | null;
  }>,
): boolean => stored.origin_job_id === input.jobId
  && stored.plugin_id === input.pluginId
  && stored.owner_ref === input.ownerRef
  && stored.subject_ref === input.subjectRef
  && stored.authorization_ref === input.authorizationRef
  && stored.frontier_ref === (input.frontier?.frontier_ref ?? null)
  && sameProvider(stored.origin_provider, input.provider)
  && sameOriginCheckpoint(stored.origin_checkpoint, input.frontier?.origin_checkpoint ?? null)
  && sameCurrentCheckpoint(stored.current_checkpoint, input.currentCheckpoint);

type AdvanceInput = Readonly<{
  lane: GptContinuationLane;
  jobId: string;
  pluginId: string;
  provider: GptProviderContinuation;
  currentCheckpoint: GptContinuationCheckpoint;
}>;

const isSettledAdvance = (
  stored: StoredGptContinuation | null,
  input: AdvanceInput,
  desiredIdentity: string,
): boolean => Boolean(stored
  && stored.plugin_id === input.pluginId
  && stored.lane_owner_job_id === null
  && stored.lane_version === input.lane.lane_version
  && stored.conversation_identity_hash === desiredIdentity
  && sameProvider(stored.provider, input.provider)
  && sameCurrentCheckpoint(stored.current_checkpoint, input.currentCheckpoint));

const isAcquiredAdvance = (stored: StoredGptContinuation | null, input: AdvanceInput): boolean => Boolean(stored
  && stored.plugin_id === input.pluginId
  && stored.lane_owner_job_id === input.jobId
  && stored.lane_version === input.lane.lane_version
  && stored.conversation_identity_hash === gptContinuationIdentityHash(input.lane.provider)
  && sameProvider(stored.provider, input.lane.provider));

export class GptSessionController {
  public constructor(private readonly store: GptContinuationStorePort) {}

  public reserve(input: GptContinuationReservation): GptContinuationReservationReadback {
    const binding = this.store.readGptContinuationExecutionBinding(input.creator_job_id);
    if (input.creator_plugin_version < 1 || input.lane_version < 1) {
      throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_INVALID");
    }
    if (!binding
      || binding.plugin_id !== input.creator_plugin_id
      || binding.plugin_version !== input.creator_plugin_version
      || binding.owner_ref !== input.owner_ref
      || binding.subject_ref !== input.subject_ref
      || binding.authorization_ref !== input.authorization_ref) {
      throw executionFailure("failed", "GPT_CONTINUATION_RESERVATION_AUTHORIZATION_INVALID");
    }
    return this.store.reserveExactGptContinuation(input);
  }

  public complete(input: GptContinuationCompletionInput): StoredGptContinuation {
    assertProviderCheckpointPair(input.provider, input.checkpoint, input.provider.prior_task_id);
    return this.store.completeExactGptContinuationReservation(input);
  }

  public persist(input: Readonly<{
    continuationRef: string;
    jobId: string;
    pluginId: string;
    ownerRef: string;
    subjectRef: string;
    authorizationRef: string;
    provider: GptProviderContinuation | null;
    currentCheckpoint: GptContinuationCheckpoint | null;
    frontier: GptContinuationFrontierBinding | null;
  }>): string | null {
    if (!input.provider || !input.currentCheckpoint) return null;
    assertProviderCheckpointPair(input.provider, input.currentCheckpoint, input.jobId);
    if (input.frontier) {
      assertProviderCheckpointPair(input.provider, input.frontier.origin_checkpoint, input.jobId);
      if (!originMatchesCurrent(input.frontier.origin_checkpoint, input.currentCheckpoint)) {
        throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_CURRENT_NOT_ORIGIN");
      }
    }
    const continuationRef = input.continuationRef;
    const existing = this.store.readGptContinuation(continuationRef);
    if (existing) {
      if (!samePersistedContent(existing, {
        jobId: input.jobId,
        pluginId: input.pluginId,
        ownerRef: input.ownerRef,
        subjectRef: input.subjectRef,
        authorizationRef: input.authorizationRef,
        provider: input.provider,
        currentCheckpoint: input.currentCheckpoint,
        frontier: input.frontier,
      })) {
        throw executionFailure("failed", "GPT_CONTINUATION_IDEMPOTENCY_CONFLICT");
      }
      return continuationRef;
    }
    if (input.frontier && this.store.readGptContinuationForFrontier(input.frontier.frontier_ref)) {
      throw executionFailure("failed", "GPT_CONTINUATION_FRONTIER_CONFLICT");
    }
    this.store.createGptContinuation({
      continuation_ref: continuationRef,
      origin_job_id: input.jobId,
      plugin_id: input.pluginId,
      owner_ref: input.ownerRef,
      subject_ref: input.subjectRef,
      authorization_ref: input.authorizationRef,
      conversation_identity_hash: gptContinuationIdentityHash(input.provider),
      frontier_ref: input.frontier?.frontier_ref ?? null,
      origin_provider: input.provider,
      origin_checkpoint: input.frontier?.origin_checkpoint ?? null,
      provider: input.provider,
      current_checkpoint: input.currentCheckpoint,
      lane_version: 0,
      lane_owner_job_id: null,
    });
    return continuationRef;
  }

  public acquire(input: Readonly<{
    continuationRef: string;
    jobId: string;
    pluginId: string;
    ownerRef: string;
    subjectRef: string;
    authorization: AcquireGptContinuationLaneAuthorization;
    parentManifestId?: string;
    parentManifestHash?: `sha256:${string}`;
  }>): GptContinuationLane {
    const binding = this.store.readGptContinuationExecutionBinding(input.jobId);
    const current = this.store.readGptContinuation(input.continuationRef);
    if (!binding
      || binding.plugin_id !== input.pluginId
      || binding.owner_ref !== input.ownerRef
      || binding.subject_ref !== input.subjectRef
      || !current
      || !gptContinuationUsable(current)
      || current.owner_ref !== input.ownerRef
      || current.subject_ref !== input.subjectRef
      || current.conversation_identity_hash !== gptContinuationIdentityHash(current.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_NOT_AUTHORIZED");
    }
    if (input.authorization.kind === "row_authorization") {
      if (input.authorization.currentAuthorizationRef !== binding.authorization_ref
        || input.authorization.currentAuthorizationRef !== current.authorization_ref
        || input.parentManifestId !== undefined || input.parentManifestHash !== undefined) {
        throw executionFailure("failed", "GPT_CONTINUATION_NOT_AUTHORIZED");
      }
    } else {
      if (input.authorization.currentJobId !== input.jobId
        || input.authorization.currentAuthorizationRef !== binding.authorization_ref
        || !input.parentManifestId || !input.parentManifestHash
        || input.authorization.opaqueLaneUseGrantHash !== hashCanonical({
          kind: "continuation_lane_use_grant.v1",
          current_job_id: input.jobId,
          current_authorization_ref: input.authorization.currentAuthorizationRef,
          parent_authorization_ref: current.authorization_ref,
          owner_ref: current.owner_ref,
          subject_ref: current.subject_ref,
          parent_manifest_id: input.parentManifestId,
          parent_manifest_hash: input.parentManifestHash,
          continuation_ref: current.continuation_ref,
        })) {
        throw executionFailure("failed", "GPT_CONTINUATION_LANE_USE_GRANT_INVALID");
      }
    }
    const acquired = this.store.acquireGptContinuationLane(input.continuationRef, input.jobId);
    if (acquired.plugin_id !== current.plugin_id
      || acquired.conversation_identity_hash !== current.conversation_identity_hash) {
      this.store.releaseGptContinuationLane(acquired.continuation_ref, input.jobId, acquired.lane_version);
      throw executionFailure("failed", "GPT_CONTINUATION_CAS_DRIFT");
    }
    return Object.freeze({
      continuation_ref: acquired.continuation_ref,
      lane_version: acquired.lane_version,
      provider: acquired.provider,
    });
  }

  public advance(input: AdvanceInput): void {
    assertProviderCheckpointPair(input.provider, input.currentCheckpoint, input.jobId);
    const desiredIdentity = gptContinuationIdentityHash(input.provider);
    const before = this.store.readGptContinuation(input.lane.continuation_ref);
    if (isSettledAdvance(before, input, desiredIdentity)) return;
    if (!isAcquiredAdvance(before, input)) {
      throw executionFailure("failed", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
    }
    try {
      this.store.advanceGptContinuationLane({
        continuationRef: input.lane.continuation_ref,
        ownerJobId: input.jobId,
        laneVersion: input.lane.lane_version,
        pluginId: input.pluginId,
        provider: input.provider,
        currentCheckpoint: input.currentCheckpoint,
        conversationIdentityHash: desiredIdentity,
      });
      return;
    } catch (error) {
      const current = this.store.readGptContinuation(input.lane.continuation_ref);
      if (isSettledAdvance(current, input, desiredIdentity)) return;
      throw error;
    }
  }

  public release(lane: GptContinuationLane, jobId: string): void {
    const current = this.store.readGptContinuation(lane.continuation_ref);
    if (!current
      || current.lane_version !== lane.lane_version
      || (current.lane_owner_job_id !== null && current.lane_owner_job_id !== jobId)) {
      throw executionFailure("failed", "GPT_CONTINUATION_RELEASE_CAS_FAILED");
    }
    if (current.lane_owner_job_id === null) return;
    if (!sameProvider(current.provider, lane.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_RELEASE_CAS_FAILED");
    }
    this.store.releaseGptContinuationLane(lane.continuation_ref, jobId, lane.lane_version);
    const released = this.store.readGptContinuation(lane.continuation_ref);
    if (!released || released.lane_owner_job_id !== null
      || released.lane_version !== lane.lane_version
      || !sameProvider(released.provider, lane.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_RELEASE_CAS_FAILED");
    }
  }

  public readVerified(continuationRef: string): StoredGptContinuation {
    const stored = this.store.readGptContinuation(continuationRef);
    if (!stored || stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
    }
    if (!stored.current_checkpoint) {
      throw executionFailure("failed", "GPT_CONTINUATION_CURRENT_CHECKPOINT_MISSING");
    }
    assertProviderCheckpointPair(stored.provider, stored.current_checkpoint, stored.origin_job_id);
    if (stored.origin_checkpoint) {
      assertProviderCheckpointPair(stored.origin_provider, stored.origin_checkpoint, stored.origin_job_id);
    }
    return stored;
  }
}
