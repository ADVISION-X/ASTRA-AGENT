import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Project } from "ts-morph";

import { inspectPublicKnowledgeImageOwnership } from "../../audit/domains/architecture-boundary/inspector.js";

import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { typedExecutionFailure } from "../../../src/lib/execution-failure.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { browserProviderEffectIdentityHash } from
  "../../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { hashCanonical } from "../../../src/mediator/product-plugin-contract.js";
import { parsePublicKnowledgeArticle, parsePublicKnowledgeResearch, publicKnowledgeTurnContract } from "../../../src/plugins/public-knowledge-article-pipeline/result-contract.js";
import {
  exerciseSeoAttachmentReconcileFailure,
  exerciseSeoFlow,
  exerciseSeoPromptWriteFailure,
} from "./public-knowledge-article-pipeline-flow.test-runtime.js";
import { createContext, ORIENTED_IMAGE_FIXTURE } from "./public-knowledge-article-pipeline.test-runtime.js";
import { createHarness, seoTask } from
  "./public-knowledge-article-pipeline-fixture-state.js";
import { articleOutput, researchOutput } from
  "./public-knowledge-article-pipeline-output-fixtures.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "public-knowledge-article-pipeline");
assert(plugin);
const produceRoute = productionRoutePolicy("public_knowledge_article_pipeline", "produce_article");

const profile = [
  "open_gpt_execution_profile", "open_gpt_model_selector_v3", "select_gpt_model_from_start_v3",
  "select_gpt_reasoning_from_start_v3", "close_gpt_execution_profile",
] as const;
const attachments = [
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
] as const;
const textTurn = [
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
const initialText = ["prepare_clean_gpt_chat", ...profile, ...attachments, ...textTurn] as const;
const continuedText = [...profile, ...textTurn] as const;
const continuedImage = [...profile, "write_exact_gpt_prompt",
  "submit_exact_gpt_turn_once", "checkpoint_gpt_generated_image"] as const;

const source = readFileSync("src/plugins/public-knowledge-article-pipeline/index.ts", "utf8");
const resultContractSource = readFileSync(
  "src/plugins/public-knowledge-article-pipeline/result-contract.ts", "utf8",
);
const turnContractSource = readFileSync(
  "src/plugins/public-knowledge-article-pipeline/seo-turn-contract.ts", "utf8",
);
assert.doesNotMatch(source, /PRODUCT_FLOW_NOT_IMPLEMENTED:|throw new Error/u);
assert.doesNotMatch(`${source}\n${resultContractSource}`, /_agent_reception|lossless-normalization|normalizeTurn|RESEARCH_STRING_ARRAY_PATHS/u,
  "AGENT must not reshape Provider output or append a second reception contract");
assert.match(source, /corpus_research/u);
assert.match(source, /article_synthesis/u);
assert.match(source, /article_image_generation/u);
const turnMarkerSource = turnContractSource.match(/export const turnMarker[\s\S]*?;\n/u)?.[0] ?? "";
assert.match(turnMarkerSource,
  /hashCanonical\(\{ job_id: task\.job_id, product_step_id: stepId \}\)/u,
  "the Product prompt remains stable while Browser identity adds attempt_id separately");
assert.doesNotMatch(turnMarkerSource, /attempt/iu,
  "attempt identity belongs to the Browser fence rather than the Product prompt marker");
{
  const identityState = createHarness("produce_article");
  const context = createContext(identityState, "proceed");
  const mismatchedContext = Object.freeze({
    ...context,
    gpt: Object.freeze({ ...context.gpt, jobId: "job-not-owned-by-this-task" }),
  });
  await assert.rejects(
    () => plugin.execute(seoTask("produce_article"), mismatchedContext),
    (error: unknown) => typedExecutionFailure(error)?.code === "SEO_GPT_JOB_IDENTITY_MISMATCH",
    "Product must fail closed before deriving Provider filenames from a mismatched GPT job identity",
  );
  assert.equal(identityState.calls.length, 0,
    "job identity mismatch must fail before any GPT Child is invoked");
}
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), topic_manifest: { primary_question: "incomplete" },
}), produceRoute).schema_version, "public-knowledge-research-output.v3");
const wrongTypeResearch = parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"),
  topic_manifest: { ...researchOutput("proceed").topic_manifest, secondary_cluster_ids: "one" },
}), produceRoute);
assert.equal((wrongTypeResearch.topic_manifest as Record<string, unknown>).secondary_cluster_ids, "one",
  "AGENT must preserve a Provider field-type error for the Website owner to judge");
assert.equal(parsePublicKnowledgeArticle(JSON.stringify({
  ...articleOutput(),
}), produceRoute).schema_version, "public-knowledge-article-output.v3");

const decline = await exerciseSeoFlow(plugin, "produce_article", "decline");
assert.deepEqual(decline.calls.map((call) => call.child), initialText);
assert.equal(decline.calls.some((call) => call.productStepId === "article_synthesis"), false);

const proceed = await exerciseSeoFlow(plugin, "produce_article", "proceed");
assert.deepEqual(proceed.calls.map((call) => call.child), [
  ...initialText, ...continuedText, ...continuedImage,
]);
const reasoningProfileCalls = proceed.calls.filter(
  (call) => call.child === "select_gpt_reasoning_from_start_v3",
);
assert.equal(reasoningProfileCalls.length, 3);
for (const call of reasoningProfileCalls) {
  assert.equal(call.input.profile.profileRef,
    "public-knowledge-article-pipeline:chatgpt-latest-extra-high");
  assert.equal(call.input.profile.startModelDisplayName, "最新");
  assert.equal(call.input.profile.requestedReasoningValue, 4);
}
assert.deepEqual([...new Set(proceed.calls.map((call) => call.productStepId))], [
  "corpus_research", "article_synthesis", "article_image_generation",
]);
assert.equal(proceed.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1);
assert.equal(proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 3);
assert.deepEqual(proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once")
  .map((call) => call.input.files.length), [1, 0, 0]);
const prompts = proceed.calls.filter((call) => call.child === "write_exact_gpt_prompt")
  .map((call) => String(call.input.prompt));
const promptContract = (prompt: string) => prompt.split("\n")
  .find((line) => line.startsWith("当前回合唯一输出子合同："))
  ?.slice("当前回合唯一输出子合同：".length);
assert.equal(promptContract(prompts[0]!), JSON.stringify(publicKnowledgeTurnContract(produceRoute, "research")));
assert.equal(promptContract(prompts[1]!), JSON.stringify(publicKnowledgeTurnContract(produceRoute, "article")));
assert.match(prompts[0]!, /public-knowledge-research-output\.v3/u);
assert.match(prompts[1]!, /public-knowledge-article-output\.v3/u);
assert.match(prompts[0]!, /输出子合同只约束交付格式与字段关系，不限制你的选题、分析、推理、观点或证据解释/u);
assert.match(prompts[1]!, /输出子合同只约束交付格式与字段关系，不限制你的分析、推理、观点或证据解释/u);
assert.match(prompts[0]!, /"field_relations":\{"cluster_ids_unique_and_from_current_domain_archive":true/u);
assert.match(prompts[0]!, /"required_nonempty_when_proceed":\["topic_manifest\.primary_question"/u);
assert.match(prompts[0]!, /"claim_support":\{"boundary_claim_may_omit_supporting_citations":true/u);
assert.match(prompts[0]!, /"field_types":\{"string":\["schema_version","decision"/u);
assert.match(prompts[0]!, /"citation_token":\{"outer_brackets":"optional_single_pair"/u);
assert.match(prompts[1]!, /"article_markdown_format":\{"nonempty":true,"body_only":true,"repeat_title":false,"allowed_heading_levels":\[2,3\]/u);
assert.match(prompts[1]!, /"required_nonempty":\["title","editor_note","article_markdown"\]/u);
assert.match(prompts[1]!, /"field_relations":\{"every_research_citation_has_article_marker":true/u);
assert.match(prompts[1]!, /"citation_marker_token":\{"format":"\[citation_reference\]"/u);
for (const hidden of ["analysis_method", "reasoning_policy", "viewpoint_policy", "evidence_interpretation", "image_creative_policy", "forbidden_body_phrases"]) assert.doesNotMatch(`${prompts[0]}\n${prompts[1]}`, new RegExp(`"${hidden}"`, "u"));
assert.doesNotMatch(prompts.join("\n"), /# 公开知识文章生产|严格区分古籍原文|用简体中文一次讲清|不得宿命绝对化|不得重新选题/u,
  "Provider Prompt must not inject Product Skill analysis or expression policy");
assert.match(prompts[2]!, /一张横向文章主图/u);
assert.doesNotMatch(prompts[2]!, /无文字|无印章|不冒充/u);
assert.equal(proceed.calls.filter((call) => call.child === "prepare_clean_gpt_chat").length, 1);
assert.equal(proceed.calls.find((call) => call.child === "prepare_clean_gpt_chat")?.productStepId,
  "corpus_research");
assert.ok((proceed.completed.payload as Readonly<Record<string, unknown>>).image);
const deliveredImage = (proceed.completed.payload as Readonly<Record<string, unknown>>).image as
  Readonly<Record<string, unknown>>;
assert.equal(deliveredImage.width, 1024);
assert.equal(deliveredImage.height, 1536);
assert.deepEqual(Object.keys(deliveredImage).sort(), [
  "artifact_id", "bytes", "height", "mime_type", "object_ref", "receipt_hash",
  "schema_version", "sha256", "width",
], "the delivered image must contain exactly the task-result v13 image fields");
assert.deepEqual(Object.keys(proceed.completed.payload as Readonly<Record<string, unknown>>).sort(),
  ["article", "image", "research", "schema_version"],
  "the delivered package must contain only the Website canonical fields");
assert.equal(proceed.generatedImageUploadCalls, 1);

{
  const oriented = createHarness("produce_article");
  await plugin.execute(seoTask("produce_article"), createContext(
    oriented, "proceed", undefined, "attempt-oriented", ORIENTED_IMAGE_FIXTURE,
  ));
  const image = (oriented.completed?.payload as Readonly<Record<string, unknown>>).image as
    Readonly<Record<string, unknown>>;
  assert.equal(image.width, 640);
  assert.equal(image.height, 320);
}

{
  const leakedReceipt = createHarness("produce_article");
  const context = createContext(leakedReceipt, "proceed");
  const upload = context.uploadGeneratedImage;
  const leakedContext = {
    ...context,
    uploadGeneratedImage: (async (artifact: Parameters<typeof upload>[0]) => ({
      ...await upload(artifact), originalSha256: `sha256:${"f".repeat(64)}`,
    })) as typeof upload,
  } as typeof context;
  await assert.rejects(() => plugin.execute(seoTask("produce_article"), leakedContext),
    /PUBLIC_KNOWLEDGE_IMAGE_INVALID/u,
    "task-result v13 must reject every extra generated-image field before completion");
  assert.equal(leakedReceipt.generatedImageUploadCalls, 1);
  assert.equal(leakedReceipt.completed, null,
    "a receipt carrying Provider-original identity must not reach Website completion");
}

const rejectImageCheckpointMutant = async (
  label: string,
  mutate: (result: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>,
): Promise<void> => {
  const state = createHarness("produce_article");
  const context = createContext(state, "proceed");
  const execute = context.gpt.execute;
  const mutantContext = {
    ...context,
    gpt: { ...context.gpt, execute: (async (input: Parameters<typeof execute>[0]) => {
      const result = await execute(input);
      return input.child === "checkpoint_gpt_generated_image" ? mutate({ ...result }) : result;
    }) as typeof execute },
  } as typeof context;
  await assert.rejects(() => plugin.execute(seoTask("produce_article"), mutantContext),
    (error: unknown) => ["SEO_IMAGE_ARTIFACT_INVALID", "SEO_IMAGE_ARTIFACT_RECEIPT_INVALID"]
      .includes(typedExecutionFailure(error)?.code ?? ""), label);
  assert.equal(state.generatedImageUploadCalls, 0, `${label}: upload increment must remain zero`);
  assert.equal(state.completed, null, `${label}: completion increment must remain zero`);
};

await rejectImageCheckpointMutant("raw hash mismatch", (result) => ({ ...result,
  value: { ...(result.value as Readonly<Record<string, unknown>>),
    originalSha256: `sha256:${"0".repeat(64)}` },
}));
await rejectImageCheckpointMutant("raw size mismatch", (result) => ({ ...result,
  value: { ...(result.value as Readonly<Record<string, unknown>>),
    originalSizeBytes: Number((result.value as Readonly<Record<string, unknown>>).originalSizeBytes) + 1 },
}));
await rejectImageCheckpointMutant("missing raw artifact receipt", (result) => ({
  ...result, artifactRefs: [],
}));
await rejectImageCheckpointMutant("duplicate raw artifact receipt", (result) => ({
  ...result, artifactRefs: ["artifact:image-original", "artifact:image-duplicate"],
}));
const damagedBytes = new Uint8Array([1, 2, 3, 4]);
const damagedHash = `sha256:${createHash("sha256").update(damagedBytes).digest("hex")}`;
await rejectImageCheckpointMutant("undecodable authenticated image", (result) => ({ ...result,
  value: { ...(result.value as Readonly<Record<string, unknown>>), originalBytes: damagedBytes,
    originalSizeBytes: damagedBytes.byteLength, originalSha256: damagedHash, mediaHash: damagedHash },
}));

const nextAttempt = await exerciseSeoFlow(
  plugin, "produce_article", "proceed", undefined, false, "attempt-2",
);
const submits = proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once");
const nextAttemptSubmits = nextAttempt.calls.filter((call) => call.child === "submit_exact_gpt_turn_once");
assert.equal(submits.length, 3);
assert.equal(nextAttemptSubmits.length, 3);
assert.deepEqual(nextAttemptSubmits.map((call) => call.input), submits.map((call) => call.input),
  "the complete submit input, including Prompt marker and attachment names, must be byte-stable across attempts");
for (const [index, call] of submits.entries()) {
  const nextCall = nextAttemptSubmits[index]!;
  const identity = (attemptId: string, revision: number, input: typeof call.input): `sha256:${string}` => {
    const requestHash = hashCanonical([revision, hashCanonical(input)]);
    return (
    browserProviderEffectIdentityHash({
    jobId: "job-produce_article",
    attemptId,
    resultRevision: revision,
    productStepId: call.productStepId,
    callId: call.callId,
    childCapabilityId: call.child,
    inputHash: requestHash,
    } as never, hashCanonical({ child: call.child, input })));
  };
  assert.equal(identity("attempt-1", 0, call.input), identity("attempt-2", 0, nextCall.input),
    `submit ${index + 1} must retain one Browser provider-effect identity across attempts`);
  assert.notEqual(identity("attempt-1", 0, call.input), identity("attempt-2", 1, nextCall.input),
    `submit ${index + 1} must receive a new identity only for a new result revision`);
}

const attachmentBlocked = await exerciseSeoAttachmentReconcileFailure(plugin);
assert.equal(typedExecutionFailure(attachmentBlocked.failure)?.code, "GPT_ATTACHMENT_UPLOAD_TIMEOUT");
assert.equal(attachmentBlocked.calls.at(-1)?.child, "reconcile_gpt_attachment_set");
assert.equal(attachmentBlocked.calls.some((call) => call.child === "write_exact_gpt_prompt"), false,
  "Prompt input must not start until the exact attachment set is ready");
assert.equal(attachmentBlocked.calls.some((call) => call.child === "submit_exact_gpt_turn_once"), false,
  "submit must not start when attachment readiness fails");
assert.equal(attachmentBlocked.physicalSubmitDispatches, 0);

const promptBlocked = await exerciseSeoPromptWriteFailure(plugin);
assert.equal(typedExecutionFailure(promptBlocked.failure)?.code, "GPT_PROMPT_WRITE_UNCONFIRMED");
assert.equal(promptBlocked.calls.at(-1)?.child, "write_exact_gpt_prompt");
assert.equal(promptBlocked.calls.some((call) => call.child === "submit_exact_gpt_turn_once"), false,
  "submit must not start after exact Prompt readback fails");
assert.equal(promptBlocked.physicalSubmitDispatches, 0);
assert.equal(promptBlocked.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1,
  "the old attempt must have performed its own attachment preparation before the pre-submit failure");
assert.equal(nextAttempt.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1,
  "a new attempt for the same job must upload the approved attachment again");

{
  const recovered = createHarness("produce_article");
  recovered.confirmedSubmitSteps = new Set([
    "corpus_research", "article_synthesis", "article_image_generation",
  ]);
  await plugin.execute(seoTask("produce_article"), createContext(recovered, "proceed"));
  assert.deepEqual(recovered.submitReadbackQueries.map((call) => call.productStepId), [
    "corpus_research", "article_synthesis", "article_image_generation",
  ]);
  assert.deepEqual(recovered.calls.map((call) => call.child), [
    "checkpoint_gpt_text_response", "checkpoint_gpt_text_response", "checkpoint_gpt_generated_image",
  ], "confirmed submit readback must skip fresh, profile, attachment, prompt and submit actions");
  assert.equal(recovered.physicalSubmitDispatches, 0);
  assert(recovered.completed, "zero-input confirmed readback must still assemble one Product result");
}

await assert.rejects(
  () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
    child: "checkpoint_gpt_text_response", code: "GPT_PROVIDER_TERMINAL_DECLINED",
  }),
  (error: unknown) => typedExecutionFailure(error)?.code === "GPT_PROVIDER_TERMINAL_DECLINED",
);
for (const action of ["accuracy_challenge", "quality_reflection"] as const) {
  const review = await exerciseSeoFlow(plugin, action);
  assert.deepEqual(review.calls.map((call) => call.child), initialText);
  assert.equal(review.calls.some((call) => call.child.includes("continuation")), false);
}
/** The Sharp image owner of this Product must pass, and geometry, original leakage and second-owner mutants must fail. */
const exerciseImageOwnership = (): void => {
  const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V15";
  const tsConfigFilePath = "tsconfig.json";
  {
    const project = new Project({ tsConfigFilePath });
    const findings: Parameters<typeof inspectPublicKnowledgeImageOwnership>[1] = [];
    inspectPublicKnowledgeImageOwnership({ project, sealedRoot: process.cwd() } as never,
      findings, new Set<string>(), lawId);
    assert.ok(!findings.some((finding) =>
      finding.checkId === "architecture-boundary/public-knowledge-image-owner"),
    "the current production image owner must pass before mutation checks run");
  }

  for (const mutate of [
    (project: Project) => {
      const file = project.getSourceFileOrThrow(resolve(
        "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts",
      ));
      file.replaceWithText(file.getFullText().replace(".rotate().webp(", ".resize(1200, 630).webp("));
    },
    (project: Project) => {
      const file = project.getSourceFileOrThrow(resolve(
        "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts",
      ));
      file.replaceWithText(file.getFullText().replace(".rotate().webp(", ".rotate().flop().webp("));
    },
    (project: Project) => {
      const file = project.getSourceFileOrThrow(resolve("src/mediator/product-plugin-contract.ts"));
      file.replaceWithText(file.getFullText().replace("readonly webp_bytes: Uint8Array;",
        "readonly webp_bytes: Uint8Array; readonly originalSha256: ProductionHash;"));
    },
    (project: Project) => project.createSourceFile(resolve(
      "src/plugins/public-knowledge-article-pipeline/second-sharp-owner-mutant.ts",
    ), 'import sharp from "sharp"; export const mutant = sharp;'),
  ] as const) {
    const project = new Project({ tsConfigFilePath });
    mutate(project);
    const findings: Parameters<typeof inspectPublicKnowledgeImageOwnership>[1] = [];
    inspectPublicKnowledgeImageOwnership({ project, sealedRoot: process.cwd() } as never,
      findings, new Set<string>(), lawId);
    assert.ok(findings.some((finding) =>
      finding.checkId === "architecture-boundary/public-knowledge-image-owner"),
    "generated-image geometry, original leakage and second Sharp owner mutants must fail");
  }
};
exerciseImageOwnership();
process.stdout.write("[ACCEPTANCE][public-knowledge-article-pipeline] PASS\n");
