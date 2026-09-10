import { gptAttachmentProviderDisplayName, type GptContinuationCheckpointInput,
  type GptProviderContinuation, type ProductGptAnyCallInput } from
  "../../../src/capabilities/gpt/index.js";
import type { ProductPluginOutput, SharedExecutionContext, WebsiteAgentTask } from
  "../../../src/mediator/product-plugin-contract.js";
import { task } from "../agent-production-runtime-fixtures.js";

export const HASH = `sha256:${"1".repeat(64)}` as const;
export const CONFIRMED_AT = new Date(Date.now() - 1_000).toISOString();

export type SeoAction = "produce_article" | "accuracy_challenge" | "quality_reflection";
export type SeoCall = ProductGptAnyCallInput & Readonly<{ sessionKey: string }>;
export type SeoFailure = Readonly<{
  child: string;
  code: string;
  productStepId?: string;
  confirmedSubmit?: boolean;
  locatorFailureCode?: string;
}>;
export type SeoFact = Readonly<{
  attemptId: string;
  callIdentityHash: string;
  evidenceRef: string;
  failureCode: string | null;
  mutation: boolean;
  terminalAt: string | null;
}>;
export type SeoHarness = {
  actionId: SeoAction;
  calls: SeoCall[];
  factsByCall: Map<string, SeoFact>;
  handoffDelays: number[];
  completed: ProductPluginOutput | null;
  continuationProvider: GptProviderContinuation | null;
  originProvider: GptProviderContinuation | null;
  frontierRef: `sha256:${string}` | null;
  frontierOriginCheckpoint: Omit<Extract<GptContinuationCheckpointInput, { checkpointKind: "text" }>, "checkpointKind"> | null;
  currentCheckpoint: GptContinuationCheckpointInput | null;
  completionFailuresRemaining: number;
  continuationLaneVersion: number;
  continuationLaneOwned: boolean;
  remainingFailures: number;
  remainingLocatorFailures: number;
  physicalSubmitDispatches: number;
  generatedImageUploadCalls: number;
  uploadedImageHashes: Set<string>;
  acquiredLaneVersions: number[];
  materials: SharedExecutionContext["materials"];
  providerNames: readonly string[];
};

export const seoTask = (actionId: SeoAction): WebsiteAgentTask => task({
  jobId: `job-${actionId}`,
  productId: "public_knowledge_article_pipeline",
  actionId,
  extra: {
    parameters: { domain_id: "bazi", locale: "zh-CN", ready_corpus_snapshot_hash: HASH },
    ...(actionId === "produce_article" ? {} : {
      subject_task_ref: "subject-task", subject_result_ref: "subject-result",
      subject_result_hash: HASH, review_policy: "strict",
    }),
  },
});

const fixtureMaterials = (actionId: SeoAction): SharedExecutionContext["materials"] => actionId === "produce_article"
  ? [{ material_id: "m0", ordinal: 0, role: "ready_corpus_archive", display_name: "public-knowledge-materials.zip",
    object_ref: "object:m0", local_path: "/tmp/public-knowledge-materials.zip", sha256: HASH, bytes: 1,
    media_type: "application/zip", storage_class: "shared_static", owner_scope_hash: null,
    trust_class: "classical_source_data", may_issue_instruction: false }]
  : [
    { material_id: "m0", ordinal: 0, role: "subject_result", display_name: "one.json",
      object_ref: "object:m0", local_path: "/tmp/one.json", sha256: HASH, bytes: 1,
      media_type: "application/json", storage_class: "shared_static", owner_scope_hash: null,
      trust_class: "locked_fact", may_issue_instruction: false },
    { material_id: "m1", ordinal: 1, role: "review_contract", display_name: "two.json",
      object_ref: "object:m1", local_path: "/tmp/two.json", sha256: HASH, bytes: 1,
      media_type: "application/json", storage_class: "shared_static", owner_scope_hash: null,
      trust_class: "locked_fact", may_issue_instruction: false },
  ];

export const createHarness = (actionId: SeoAction, failureAt?: SeoFailure): SeoHarness => {
  const materials = fixtureMaterials(actionId);
  return {
    actionId, calls: [], factsByCall: new Map(), handoffDelays: [], completed: null,
    continuationProvider: null, originProvider: null, frontierRef: null,
    frontierOriginCheckpoint: null, currentCheckpoint: null, completionFailuresRemaining: 0,
    continuationLaneVersion: 0, continuationLaneOwned: false, remainingFailures: failureAt ? 1 : 0,
    remainingLocatorFailures: failureAt?.locatorFailureCode ? 1 : 0,
    physicalSubmitDispatches: 0, generatedImageUploadCalls: 0, uploadedImageHashes: new Set(),
    acquiredLaneVersions: [], materials,
    providerNames: materials.map((material) => gptAttachmentProviderDisplayName(
      material.display_name, `job-${actionId}`, material.material_id,
    )),
  };
};
