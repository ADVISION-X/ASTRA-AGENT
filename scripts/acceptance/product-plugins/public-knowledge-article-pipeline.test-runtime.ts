import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import type { ProductGptTools } from "../../../src/capabilities/gpt/index.js";
import type { SharedExecutionContext } from "../../../src/mediator/product-plugin-contract.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { executionFailure } from "../../../src/lib/execution-failure.js";
import { articleOutput, researchOutput } from "./public-knowledge-article-pipeline-output-fixtures.js";
import { CONFIRMED_AT, HASH, type SeoCall, type SeoFailure, type SeoHarness } from
  "./public-knowledge-article-pipeline-fixture-state.js";

type SeoExecuteInput = Parameters<ProductGptTools["execute"]>[0];
const SEO_CONVERSATION_URL = "https://chatgpt.com/c/seo-flow";
const userTurnId = (stepId: string): string => `conversation-turn-${
  stepId === "corpus_research" ? 1 : stepId === "article_synthesis" ? 3 : 5}`;

const outputForCall = (state: SeoHarness, call: SeoCall, decision: "proceed" | "decline"): unknown => {
  if (call.child === "reconcile_gpt_attachment_set") return { files: state.materials.map((material, index) => ({
    artifactRef: material.material_id, displayName: material.display_name,
    providerDisplayName: state.providerNames[index], sha256: HASH, bytes: 1,
  })) };
  if (call.child === "submit_exact_gpt_turn_once") return {
    status: "CONFIRMED", promptHash: call.input.promptHash,
    mutationSent: true, canonicalConversationUrl: SEO_CONVERSATION_URL,
    userTurnId: userTurnId(call.productStepId),
  };
  if (call.child === "checkpoint_gpt_text_response") {
    const payload = call.productStepId === "corpus_research" ? researchOutput(decision)
      : call.productStepId === "article_synthesis" ? articleOutput() : { decision: "no_issue", issues: [] };
    const semanticText = JSON.stringify(payload);
    return { assistantTurnId: `conversation-turn-${Number(userTurnId(call.productStepId).slice(18)) + 1}`,
      rawDomHtml: `<article>${semanticText}</article>`,
      rawDomHash: HASH, semanticText, semanticTextHash: HASH };
  }
  if (call.child === "checkpoint_gpt_generated_image") return {
    assistantTurnId: "conversation-turn-6", semanticMediaId: "gpt-generated-image-main",
    mediaHash: HASH, authorityTargetHash: HASH, authorityDocumentHash: HASH,
    canonicalConversationUrl: SEO_CONVERSATION_URL,
    turnMarker: "marker", artifactId: "image-1",
    originalBytes: new Uint8Array([1]), webpBytes: new Uint8Array([1]),
    originalSizeBytes: 1, originalMediaType: "image/png", originalWidth: 1200, originalHeight: 630,
    sha256: HASH, originalSha256: HASH, bytes: 1, mediaType: "image/webp", width: 1200, height: 630,
  };
  return {};
};

const assertCallBoundary = (call: SeoCall): void => {
  if (call.child !== "attach_approved_gpt_files_once" && call.child !== "reconcile_gpt_attachment_set") return;
  assert(Array.isArray(call.input.files));
  for (const file of call.input.files) {
    assert.deepEqual(Object.keys(file).sort(), ["artifactRef", "bytes", "displayName", "sha256"]);
  }
};

export const createContext = (
  state: SeoHarness,
  decision: "proceed" | "decline",
  failureAt?: SeoFailure,
  attemptId = "attempt-1",
): SharedExecutionContext => ({
  materials: state.materials,
  routePolicy: productionRoutePolicy("public_knowledge_article_pipeline", state.actionId),
  productSkill: Object.freeze({ text: "fixture public knowledge skill", hash: HASH }),
  gpt: {
    jobId: `job-${state.actionId}`, attemptId,
    readConfirmedSubmit: async (input) => {
      const call = input as SeoCall;
      state.submitReadbackQueries.push(call);
      if (!state.confirmedSubmitSteps.has(call.productStepId)) return null;
      const evidenceRef = `evidence:readback:${call.productStepId}`;
      return { value: outputForCall(state, call, decision), evidenceRef, evidenceHash: HASH,
        sourceAttemptId: attemptId, exactCallIdentityHash: HASH, artifactRefs: [],
        effectReceipt: {
          effectScope: "provider_effect", outcome: "CONFIRMED", mutationOutcome: "confirmed",
          terminalAt: CONFIRMED_AT, evidenceRef, evidenceHash: HASH,
        } } as never;
    },
    execute: async (input: SeoExecuteInput) => {
      const call = input as SeoCall;
      assertCallBoundary(call);
      state.calls.push(call);
      if (state.remainingFailures > 0 && call.child === failureAt?.child
        && (!failureAt.productStepId || call.productStepId === failureAt.productStepId)) {
        state.remainingFailures -= 1;
        throw executionFailure("failed", failureAt.code, { metadata: { mutationOutcome: "no" } });
      }
      if (call.child === "submit_exact_gpt_turn_once") state.physicalSubmitDispatches += 1;
      const evidenceRef = `evidence:${state.calls.length}`;
      return { value: outputForCall(state, call, decision), evidenceRef, evidenceHash: HASH,
        sourceAttemptId: attemptId, exactCallIdentityHash: HASH,
        artifactRefs: call.child === "checkpoint_gpt_text_response" ? [`artifact:${call.productStepId}`]
          : call.child === "checkpoint_gpt_generated_image"
            ? ["artifact:image-original", "artifact:image-webp", "artifact:image-receipt"] : [],
        effectReceipt: call.child === "submit_exact_gpt_turn_once" ? {
          effectScope: "provider_effect", outcome: "CONFIRMED", mutationOutcome: "confirmed",
          terminalAt: CONFIRMED_AT, evidenceRef, evidenceHash: HASH,
        } : null } as never;
    },
  },
  resultRevision: { revision: 0, priorRejection: null },
  uploadGeneratedImage: async (artifact) => {
    state.generatedImageUploadCalls += 1;
    return { artifact_id: artifact.artifact_id, object_ref: `object:${artifact.artifact_id}`,
      sha256: artifact.sha256, receipt_hash: HASH, bytes: artifact.bytes,
      mime_type: artifact.media_type, width: artifact.width, height: artifact.height };
  },
  complete: async (output) => {
    state.completed = output;
    return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
  },
});

export const withFastHandoffs = async <T>(_state: SeoHarness, run: () => Promise<T>): Promise<T> => run();
