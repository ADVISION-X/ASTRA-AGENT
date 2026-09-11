import type {
  GptChildCapabilityId,
  GptChildInputMap,
  GptChildOutputMap,
} from "./contract.js";

export type ProductGptChildResult<K extends GptChildCapabilityId = GptChildCapabilityId> =
  Readonly<{
    value: GptChildOutputMap[K];
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
    sourceAttemptId: string;
    exactCallIdentityHash: `sha256:${string}`;
    artifactRefs: readonly string[];
    effectReceipt: Readonly<{
      effectScope: "target_local" | "provider_effect";
      outcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutationOutcome: "no" | "dispatched" | "confirmed";
      terminalAt: string | null;
      evidenceRef: string;
      evidenceHash: `sha256:${string}`;
    }> | null;
  }>;

type ProductGptCallCommon = Readonly<{
  sessionKey?: string;
  productStepId: string;
  callId: string;
  actionOrdinal: number;
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

export interface ProductGptTools {
  readonly jobId: string;
  readonly attemptId: string;
  execute<K extends GptChildCapabilityId>(
    input: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
  ): Promise<ProductGptChildResult<K>>;
  acquireContinuation(input: Readonly<{
    sessionKey: string;
    productStepId: string;
    callId: string;
    consultationIdentityHash: `sha256:${string}`;
    predecessorSourceTaskRef: string;
  }>): Promise<Readonly<{
    canonicalConversationUrl: string;
    promptHash: `sha256:${string}`;
    turnMarker: string;
    assistantTurnId: string;
    semanticTextHash: `sha256:${string}`;
  }>>;
  recordContinuation(input: Readonly<{
    submitEvidenceRef: string;
    sourceTaskRef: string;
    consultationIdentityHash: `sha256:${string}`;
    checkpoint: Readonly<{
      canonicalConversationUrl: string;
      promptHash: `sha256:${string}`;
      turnMarker: string;
      assistantTurnId: string;
      semanticTextHash: `sha256:${string}`;
    }>;
  }>): void;
}
