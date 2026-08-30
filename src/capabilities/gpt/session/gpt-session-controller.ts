import { createHash } from "node:crypto";
import { executionFailure } from "../../../lib/typed-failure.js";

import type {
  GptContinuationStorePort,
  GptProviderContinuation,
  StoredGptContinuation,
} from "./gpt-continuation-store-port.js";

export interface GptContinuationLane {
  readonly continuation_ref: string;
  readonly lane_version: number;
  readonly provider: GptProviderContinuation;
}

export const gptContinuationIdentityHash = (
  provider: GptProviderContinuation,
): `sha256:${string}` => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(provider.prior_prompt_hash)
    || !/^sha256:[a-f0-9]{64}$/u.test(provider.prior_raw_output_hash)) {
    throw executionFailure("failed", "GPT_CONTINUATION_PROVIDER_INVALID");
  }
  return `sha256:${createHash("sha256").update(JSON.stringify({
    prior_raw_output_hash: provider.prior_raw_output_hash,
    prior_prompt_hash: provider.prior_prompt_hash,
    prior_task_id: provider.prior_task_id,
    prior_turn_marker: provider.prior_turn_marker,
    provider_page_url: provider.provider_page_url,
  })).digest("hex")}`;
};

const sameProvider = (left: GptProviderContinuation, right: GptProviderContinuation): boolean =>
  gptContinuationIdentityHash(left) === gptContinuationIdentityHash(right)
  && left.provider_page_url === right.provider_page_url
  && left.prior_task_id === right.prior_task_id
  && left.prior_prompt_hash === right.prior_prompt_hash
  && left.prior_raw_output_hash === right.prior_raw_output_hash
  && left.prior_turn_marker === right.prior_turn_marker;

export class GptSessionController {
  public constructor(private readonly store: GptContinuationStorePort) {}

  public persist(input: Readonly<{
    continuationRef: string;
    jobId: string;
    pluginId: string;
    ownerRef: string;
    subjectRef: string;
    authorizationRef: string;
    provider: GptProviderContinuation | null;
  }>): string | null {
    if (!input.provider) return null;
    const continuationRef = input.continuationRef;
    const existing = this.store.readGptContinuation(continuationRef);
    if (existing) {
      if (existing.origin_job_id !== input.jobId
        || existing.plugin_id !== input.pluginId
        || existing.owner_ref !== input.ownerRef
        || existing.subject_ref !== input.subjectRef
        || existing.authorization_ref !== input.authorizationRef
        || existing.conversation_identity_hash !== gptContinuationIdentityHash(input.provider)
        || !sameProvider(existing.provider, input.provider)) {
        throw executionFailure("failed", "GPT_CONTINUATION_IDEMPOTENCY_CONFLICT");
      }
      return continuationRef;
    }
    this.store.createGptContinuation({
      continuation_ref: continuationRef,
      origin_job_id: input.jobId,
      plugin_id: input.pluginId,
      owner_ref: input.ownerRef,
      subject_ref: input.subjectRef,
      authorization_ref: input.authorizationRef,
      conversation_identity_hash: gptContinuationIdentityHash(input.provider),
      provider: input.provider,
      lane_version: 0,
      lane_owner_job_id: null,
    });
    return continuationRef;
  }

  public acquire(input: Readonly<{
    continuationRef: string;
    jobId: string;
    pluginId: string;
    allowedSourcePluginIds: readonly string[];
    ownerRef: string;
    subjectRef: string;
    authorizationRef: string;
  }>): GptContinuationLane {
    const current = this.store.readGptContinuation(input.continuationRef);
    if (!current
      || input.allowedSourcePluginIds.length === 0
      || !input.allowedSourcePluginIds.includes(current.plugin_id)
      || current.owner_ref !== input.ownerRef
      || current.subject_ref !== input.subjectRef
      || current.authorization_ref !== input.authorizationRef
      || current.conversation_identity_hash !== gptContinuationIdentityHash(current.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_NOT_AUTHORIZED");
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

  public advance(input: Readonly<{
    lane: GptContinuationLane;
    jobId: string;
    pluginId: string;
    provider: GptProviderContinuation;
  }>): void {
    const desiredIdentity = gptContinuationIdentityHash(input.provider);
    const before = this.store.readGptContinuation(input.lane.continuation_ref);
    if (before
      && before.plugin_id === input.pluginId
      && before.lane_owner_job_id === null
      && before.lane_version === input.lane.lane_version
      && before.conversation_identity_hash === desiredIdentity
      && sameProvider(before.provider, input.provider)) return;
    if (!before
      || before.plugin_id !== input.pluginId
      || before.lane_owner_job_id !== input.jobId
      || before.lane_version !== input.lane.lane_version
      || before.conversation_identity_hash !== gptContinuationIdentityHash(input.lane.provider)
      || !sameProvider(before.provider, input.lane.provider)) {
      throw executionFailure("failed", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
    }
    try {
      this.store.advanceGptContinuationLane({
        continuationRef: input.lane.continuation_ref,
        ownerJobId: input.jobId,
        laneVersion: input.lane.lane_version,
        pluginId: input.pluginId,
        provider: input.provider,
        conversationIdentityHash: desiredIdentity,
      });
      return;
    } catch (error) {
      const current = this.store.readGptContinuation(input.lane.continuation_ref);
      if (current
        && current.plugin_id === input.pluginId
        && current.lane_owner_job_id === null
        && current.lane_version === input.lane.lane_version
        && current.conversation_identity_hash === desiredIdentity
        && sameProvider(current.provider, input.provider)) return;
      throw error;
    }
  }

  public release(lane: GptContinuationLane, jobId: string): void {
    const current = this.store.readGptContinuation(lane.continuation_ref);
    if (!current
      || current.lane_version !== lane.lane_version
      || !sameProvider(current.provider, lane.provider)
      || (current.lane_owner_job_id !== null && current.lane_owner_job_id !== jobId)) {
      throw executionFailure("failed", "GPT_CONTINUATION_RELEASE_CAS_FAILED");
    }
    if (current.lane_owner_job_id === null) return;
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
    return stored;
  }
}
