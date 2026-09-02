import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const LAW_ID = "LAW-AGENT-PRODUCTION-RUNTIME-001-V30";
const PLUGIN_ROOT = "src/plugins";
const PLUGIN_ID = "public-knowledge-article-pipeline";
const finding = (checkId: string, filePath: string, message: string,
  evidenceMode: "static.ast" | "static.contract" = "static.ast"): InspectorFinding => createFinding({
  evidenceMode, lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`,
  checkId, filePath, message,
});
const read = (context: InspectorContext, path: string): string =>
  readFileSync(resolve(context.sealedRoot, path), "utf8");

const inspectFlowShape = (source: string, path: string, findings: InspectorFinding[]): void => {
  for (const required of ["context.gpt.execute", "corpus_research", "article_synthesis",
    "article_image_generation", "accuracy_challenge", "quality_reflection", "GPT-5.6 Sol",
    'reasoningTier: "pro_standard"', "acquire_gpt_continuation_lane", "advance_gpt_continuation_lane",
    "release_gpt_continuation_lane", "SEO_CHILD_HANDOFF_DELAY_MS = 2_000",
    "setTimeout(resolve, SEO_CHILD_HANDOFF_DELAY_MS)", 'publicKnowledgeTurnContract("research")',
    'publicKnowledgeTurnContract("article")', "解压并读取本轮唯一 ZIP 附件", "原文.md 与索引.json",
    "timeoutMs: 600_000", "readCallFacts", "requireEvidence", "absoluteDeadline", "prior_prompt_hash",
    "expectedPromptHash", "preservePostSubmitReadback", "researchFrontierRef", "recoverResearchTurn",
    'lookupKind: "frontier_ref"', "originCheckpoint", "?? await produceResearchTurn", "recordRecoveredEvidence"])
    if (!source.includes(required)) findings.push(finding("agent-production-runtime/seo-product-flow",
      path, `SEO Product Flow is missing ${required}.`));
  if (source.includes("PRODUCT_FLOW_NOT_IMPLEMENTED:")) findings.push(finding(
    "agent-production-runtime/seo-product-flow-stub-retired", path,
    "SEO Product Flow still contains its retired fail-closed stub."));
};

const inspectRecoveryPolicy = (source: string, path: string, findings: InspectorFinding[]): void => {
  for (const forbidden of ["CHILD_SETTLE_DELAY_MS", "seoProductExecutionTail",
    "runSeoProductExecutionExclusive", "++actionOrdinal", "actionOrdinal: 0",
    "return input.recoveryProvider.provider_page_url"])
    if (source.includes(forbidden)) findings.push(finding("agent-production-runtime/seo-product-second-scheduler-retired",
      path, `SEO Product Flow retains forbidden pacing or scheduling token ${forbidden}.`));
  if (!source.includes('code.startsWith("GPT_PROVIDER_TERMINAL_")')) findings.push(finding(
    "agent-production-runtime/seo-confirmed-submit-terminal-negative", path,
    "SEO confirmed-submit recovery must reserve termination for an explicit Provider terminal negative."));
  for (const forbidden of ['code === "GPT_RESPONSE_STABILITY_TIMEOUT"',
    'code === "GPT_IMAGE_STABILITY_TIMEOUT"', 'code === "GPT_RESPONSE_WAIT_ABORTED"',
    'code === "GPT_IMAGE_WAIT_ABORTED"', 'code.startsWith("GPT_RATE_LIMIT_")'])
    if (source.includes(forbidden)) findings.push(finding(
      "agent-production-runtime/seo-confirmed-submit-no-readback-code-gate", path,
      `SEO confirmed-submit recovery retains forbidden readback-code gate ${forbidden}.`));
  if (source.includes("JSON.stringify(task.parameters)") || /无文字|无印章|不冒充古籍原页/u.test(source))
    findings.push(finding("agent-production-runtime/seo-provider-input-leak", path,
      "SEO Prompt leaks internal parameters or duplicates Website-forbidden image creative rules."));
};

const inspectResultProjection = (
  context: InspectorContext, findings: InspectorFinding[],
): void => {
  const resultPath = `${PLUGIN_ROOT}/${PLUGIN_ID}/result-contract.ts`;
  const result = read(context, resultPath);
  for (const required of ["route.result_contract", "result.parseJsonObject", "decision_values", "Object.freeze(output)"])
    if (!result.includes(required)) findings.push(finding("agent-production-runtime/seo-result-contract-projection",
      resultPath, `SEO receiver is missing basic machine-format or lossless receipt token ${required}.`));
  if (result.includes("result.exact(output") || result.includes("result.exact(research")) findings.push(finding(
    "agent-production-runtime/seo-no-unpublished-content-gate", resultPath,
    "SEO reception must not enforce an unpublished exact AI-output field set."));
  const routePolicyPath = "src/lib/local-runtime/production/website-agent-route-policies.v1.json";
  const routePolicy = read(context, routePolicyPath);
  for (const required of ["public-knowledge-article-package-contract.v1", '"package"', '"research"',
    '"article"', '"image"', '"ready_corpus_archive"', '"application/zip"'])
    if (!routePolicy.includes(required)) findings.push(finding(
      "agent-production-runtime/seo-result-contract-projection", routePolicyPath,
      `Website route projection is missing ${required}.`, "static.contract"));
};

export const inspectSeoPlugin = (
  context: InspectorContext, source: string, path: string, findings: InspectorFinding[],
): void => {
  inspectFlowShape(source, path, findings);
  inspectRecoveryPolicy(source, path, findings);
  inspectResultProjection(context, findings);
};
