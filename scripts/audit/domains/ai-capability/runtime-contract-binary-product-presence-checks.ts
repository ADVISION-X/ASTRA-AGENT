import type { Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { aiInspectionUtils } from "./inspection-utils.js";

const { getSourceOrThrow } = aiInspectionUtils;

const VISION_PRODUCT_PRESENCE_PROMPT_PATH = "src/lib/local-ai/prompts/vision-product-presence.v1.ts";
const VISION_PRODUCT_PRESENCE_SCHEMA_PATH = "src/types/vision-product-presence.ts";
const WORKBENCH_AI_REQUEST_BUILDER_PATH = "src/lib/local-runtime/workbench-nerve-bus-ai-request-builder.ts";
const GOVERNED_TASK_EXECUTION_PATH = "src/lib/local-ai/governed-task-execution.ts";

const createBinaryProductPresenceFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-AI-CAPABILITY-002-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

const includesAny = (sourceText: string, snippets: readonly string[]): boolean => {
  return snippets.some((snippet) => sourceText.includes(snippet));
};

const hasBinaryPromptContract = (promptText: string): boolean => {
  const hasBinaryDecision = includesAny(promptText, [
    "Return exactly one product-presence decision: product_yes or product_no.",
    "Return exactly one decision: product_yes or product_no.",
    'decision must be product_yes or product_no',
  ]);
  const forbidsReviewHandoff = includesAny(promptText, [
    "Never return product_uncertain",
    "Never return review_required, product_uncertain, maybe, unknown, or mustReview=true.",
  ]) && includesAny(promptText, [
    "mustReview must stay false",
    'mustReview: "false"',
    "mustReview = false",
  ]);
  const routesAmbiguousEvidenceToProductNo = includesAny(promptText, [
    "choose product_no and explain the limiting visual evidence",
    "return decision=product_no",
    "Choose product_no only when the sampled evidence does not visibly show a concrete product presentation",
  ]) && includesAny(promptText, [
    "limiting visual evidence",
    "missing visual proof",
    "too weak to identify a product safely",
  ]);

  return hasBinaryDecision && forbidsReviewHandoff && routesAmbiguousEvidenceToProductNo;
};

const hasBinaryProductPresenceSchema = (schemaText: string): boolean => {
  return !schemaText.includes('"product_uncertain"')
    && !schemaText.includes('"review_required"')
    && !schemaText.includes('"skip_or_operator_review"');
};

const hasGovernedRequestBuilder = (requestBuilderText: string): boolean => {
  const forbiddenFramePromptRef = `promptInputRef${"Frame3s"}`;
  return requestBuilderText.includes("taskType === PRODUCT_PRESENCE_TASK_TYPE")
    && requestBuilderText.includes("minimumConfidence: null")
    && requestBuilderText.includes("reviewOnLowConfidence: false")
    && requestBuilderText.includes("route_plan_or_ability_owned_sampling")
    && !requestBuilderText.includes("PRODUCT_PRESENCE_FRAME_COUNT")
    && !requestBuilderText.includes(forbiddenFramePromptRef)
    && !requestBuilderText.includes('isProductPresence ? "multi_image" : "single_frame_fallback"');
};

const hasModelOnlyExecution = (governedTaskText: string): boolean => {
  return governedTaskText.includes("vision.productPresence forbids governed heuristic execution")
    && !governedTaskText.includes("resolveVisionDecision")
    && !governedTaskText.includes("resolveVisionClassification")
    && !governedTaskText.includes("single-frame fallback reduced trust");
};

export const findBinaryProductPresenceContractViolations = (project: Project): Finding[] => {
  const promptSource = getSourceOrThrow(project, VISION_PRODUCT_PRESENCE_PROMPT_PATH);
  const runtimePromptSource = getSourceOrThrow(project, "src/lib/local-ai/local-ai-runtime-vision-prompt.ts");
  const schemaSource = getSourceOrThrow(project, VISION_PRODUCT_PRESENCE_SCHEMA_PATH);
  const requestBuilderSource = getSourceOrThrow(project, WORKBENCH_AI_REQUEST_BUILDER_PATH);
  const governedTaskSource = getSourceOrThrow(project, GOVERNED_TASK_EXECUTION_PATH);
  const promptText = `${promptSource.getFullText()}\n${runtimePromptSource.getFullText()}`;
  const schemaText = schemaSource.getFullText();
  const requestBuilderText = requestBuilderSource.getFullText();
  const governedTaskText = governedTaskSource.getFullText();
  const findings: Finding[] = [];

  if (!hasBinaryPromptContract(promptText)) {
    findings.push(createBinaryProductPresenceFinding(VISION_PRODUCT_PRESENCE_PROMPT_PATH, "Product-presence prompt must be a detailed binary YES/NO autonomous routing contract; ambiguous evidence must become product_no, not human review."));
  }
  if (!hasBinaryProductPresenceSchema(schemaText)) {
    findings.push(createBinaryProductPresenceFinding(VISION_PRODUCT_PRESENCE_SCHEMA_PATH, "Product-presence output schema must not allow product_uncertain, review_required, or operator-review action values."));
  }
  if (!hasGovernedRequestBuilder(requestBuilderText)) {
    findings.push(createBinaryProductPresenceFinding(WORKBENCH_AI_REQUEST_BUILDER_PATH, "Workbench product-presence AI request must disable low-confidence human handoff, preserve binary autonomous routing, and keep frame sampling ownership out of map-carried refs."));
  }
  if (!hasModelOnlyExecution(governedTaskText)) {
    findings.push(createBinaryProductPresenceFinding(GOVERNED_TASK_EXECUTION_PATH, "Product-presence cannot have governed heuristic fallback execution; only model-backed AI may decide product presence."));
  }

  return findings;
};