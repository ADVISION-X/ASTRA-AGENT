import { createHash, randomUUID } from "node:crypto";
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
): `sha256:${string}` => `sha256:${createHash("sha256").update(JSON.stringify({
  prior_raw_output_hash: provider.prior_raw_output_hash,
  prior_task_id: provider.prior_task_id,
  prior_turn_marker: provider.prior_turn_marker,
  provider_page_url: provider.provider_page_url,
})).digest("hex")}`;

export class GptSessionController {
  public constructor(private readonly store: GptContinuationStorePort) {}

  public persist(input: Readonly<{
    continuationRef?: string;
    jobId: string;
    pluginId: string;
    ownerRef: string;
    subjectRef: string;
    authorizationRef: string;
    provider: GptProviderContinuation | null;
  }>): string | null {
    if (input.continuationRef) return input.continuationRef;
    if (!input.provider) return null;
    const continuationRef = `gpt-continuation:${randomUUID()}`;
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
      throw executionFailure("review_required", "GPT_CONTINUATION_NOT_AUTHORIZED");
    }
    const acquired = this.store.acquireGptContinuationLane(input.continuationRef, input.jobId);
    if (acquired.plugin_id !== current.plugin_id
      || acquired.conversation_identity_hash !== current.conversation_identity_hash) {
      this.store.releaseGptContinuationLane(acquired.continuation_ref, input.jobId, acquired.lane_version);
      throw executionFailure("review_required", "GPT_CONTINUATION_CAS_DRIFT");
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
    this.store.advanceGptContinuationLane({
      continuationRef: input.lane.continuation_ref,
      ownerJobId: input.jobId,
      laneVersion: input.lane.lane_version,
      pluginId: input.pluginId,
      provider: input.provider,
      conversationIdentityHash: gptContinuationIdentityHash(input.provider),
    });
  }

  public release(lane: GptContinuationLane, jobId: string): void {
    this.store.releaseGptContinuationLane(lane.continuation_ref, jobId, lane.lane_version);
  }

  public readVerified(continuationRef: string): StoredGptContinuation {
    const stored = this.store.readGptContinuation(continuationRef);
    if (!stored || stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
      throw executionFailure("review_required", "GPT_CONTINUATION_IDENTITY_INVALID");
    }
    return stored;
  }
}
