import type {
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
} from "./contract.js";
import type { GptContinuationLane } from "./session/gpt-session-controller.js";
import type { GptProviderContinuation } from "./session/gpt-continuation-store-port.js";

export type ProductGptChildResult<K extends GptChildCapabilityId = GptChildCapabilityId> =
  Readonly<{
    value: GptChildOutputMap[K];
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
  }>;

type ProductGptCallCommon = Readonly<{
  sessionKey?: string;
  productStepId: string;
  callId: string;
  actionOrdinal: number;
  effectLookupKind?: "task_exact_effect";
}>;

type ProductGptAnyCallInputMap = {
  readonly [K in GptChildCapabilityId]: ProductGptCallCommon & Readonly<{
    child: K;
    input: GptChildInputMap[K];
  }>;
};

export type ProductGptAnyCallInput = ProductGptAnyCallInputMap[GptChildCapabilityId];

export type ProductGptCallInput<K extends GptChildCapabilityId = GptChildCapabilityId> =
  ProductGptCallCommon & Readonly<{
    child: K;
    input: GptChildInputMap[K];
  }>;

export type ProductGptFactQuery<K extends GptChildCapabilityId = GptChildCapabilityId> =
  ProductGptCallInput<K> & Readonly<{
    lookupKind?: "current_attempt" | "task_exact_effect";
  }>;

export type ExactGptCallFacts = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
  mutation: Readonly<{
    owner: "browser";
    sourceAttemptId: string;
    effectScope: "target_local" | "provider_effect";
    outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
    terminalAt: string | null;
    productStepId: string;
    callId: string;
    childCapabilityId: string;
    actionOrdinal: number;
  }> | null;
  evidence: Readonly<{
    owner: "forensics-persistence";
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
    readbackVerified: true;
    artifactRefs: readonly string[];
  }> | null;
  continuation: Readonly<{
    owner: "gpt-session-controller";
    continuationRef: string;
    conversationIdentityHash: `sha256:${string}`;
    laneVersion: number;
    priorPromptHash: `sha256:${string}`;
    priorResponseHash: `sha256:${string}`;
    contentReadbackVerified: true;
  }> | null;
}>;

export type ExactGptContinuationQuery = Readonly<
  | { lookupKind: "turn_marker"; turnMarker: string }
  | {
    lookupKind: "frontier_ref";
    frontierRef: `sha256:${string}`;
    authorization:
      | Readonly<{ kind: "origin_authorization"; originAuthorizationRef: string }>
      | Readonly<{
        kind: "current_artifact_read_grant";
        currentAuthorizationRef: string;
        opaqueReadGrantHash: `sha256:${string}`;
      }>;
  }
>;

export type ExactGptTextCheckpointReadback = Readonly<{
  checkpointKind: "text";
  sourceAttemptId: string;
  assistantTurnId: string;
  artifactRef: string;
  rawDomHtml: string;
  rawDomHash: `sha256:${string}`;
  semanticText: string;
  semanticTextHash: `sha256:${string}`;
  canonicalConversationUrl: string;
  promptHash: `sha256:${string}`;
  turnMarker: string;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
}>;

export type ExactGptGeneratedImageCheckpointReadback = Readonly<{
  checkpointKind: "generated_image";
  sourceAttemptId: string;
  assistantTurnId: string;
  canonicalConversationUrl: string;
  promptHash: `sha256:${string}`;
  mediaHash: `sha256:${string}`;
  turnMarker: string;
  originalArtifactRef: string;
  originalSha256: `sha256:${string}`;
  originalBytes: Uint8Array;
  originalMediaType: `image/${string}`;
  originalWidth: number;
  originalHeight: number;
  webpArtifactRef: string;
  webpSha256: `sha256:${string}`;
  webpBytes: Uint8Array;
  mediaType: "image/webp";
  width: 1200;
  height: 630;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
  predecessorTextCheckpoint: ExactGptTextCheckpointReadback;
}>;

export type ExactGptContinuationReadback = Readonly<
  | { lookupKind: "turn_marker"; lane: GptContinuationLane }
  | {
    lookupKind: "frontier_ref";
    continuationRef: string;
    authorizationReadback:
      | Readonly<{ kind: "origin_authorization"; originAuthorizationRef: string }>
      | Readonly<{
        kind: "current_artifact_read_grant";
        currentAuthorizationRef: string;
        ownerScopeHash: `sha256:${string}`;
        subjectRef: string;
        sourceArtifactRef: string;
        sourceCheckpointRef: `sha256:${string}`;
        semanticAdmissionReceiptRef: string;
        semanticAdmissionReceiptHash: `sha256:${string}`;
        opaqueReadGrantHash: `sha256:${string}`;
      }>;
    originProvider: GptProviderContinuation;
    originCheckpoint: ExactGptTextCheckpointReadback;
    currentProvider: GptProviderContinuation;
    currentCheckpoint: ExactGptTextCheckpointReadback | ExactGptGeneratedImageCheckpointReadback;
  }
>;

export interface ProductGptTools {
  readonly attemptId: string;
  readContinuationExact(query: ExactGptContinuationQuery): Promise<ExactGptContinuationReadback | null>;
  execute<K extends GptChildCapabilityId>(
    input: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
  ): Promise<ProductGptChildResult<K>>;
  readCallFacts(input: ProductGptFactQuery): Promise<ExactGptCallFacts>;
}
