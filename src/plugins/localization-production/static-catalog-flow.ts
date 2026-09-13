import { readFile } from "node:fs/promises";

import { buildGptExecutionProfile } from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type SharedExecutionContext,
  type WebsiteAgentTask,
} from "../../mediator/product-plugin-contract.js";
import {
  executeIsolatedLocalizationJsonTurn,
} from "./flow.js";
import {
  fail,
  parseCandidate,
  parseInput,
  parseContext,
  parseSelector, SELECTOR_REASON_CODES, selectorReasonAllowed,
  sameStrings,
  type BlindMapping,
  type CandidateItem,
  type CandidatePayload,
  type CandidateReceipt,
  type CandidateRole,
  type ContextBundle,
  type FormalSelection,
  type StaticCatalogInput,
  type StaticCohort,
} from "./static-catalog-contract.js";

const PUBLIC_VALUE_FINDING_CODES = Object.freeze([
  "PUBLIC_VALUE_SOURCE_ROLE_LOST", "PUBLIC_VALUE_FACT_CERTAINTY_CHANGED", "PUBLIC_VALUE_EVIDENCE_ROLE_LOST",
  "PUBLIC_VALUE_PRESENT_USE_LOST", "PUBLIC_VALUE_TOOL_ROLE_PROMOTED",
]);

const candidateAProfile = buildGptExecutionProfile({
  profileRef: "localization-production:static-catalog:candidate-a:pro-standard",
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: {
    selectionPolicy: "exact-or-observed-maximum",
    requestedTier: "pro_standard",
  },
  executorIdentityRef: "localization-production:static-catalog:candidate-a",
  acceptanceRef: "localization-production:static-catalog",
  acceptanceVersion: "v1",
});

const candidateBProfile = buildGptExecutionProfile({
  profileRef: "localization-production:static-catalog:candidate-b:high",
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  executorIdentityRef: "localization-production:static-catalog:candidate-b",
  acceptanceRef: "localization-production:static-catalog",
  acceptanceVersion: "v1",
});

const selectorProfile = buildGptExecutionProfile({
  profileRef: "localization-production:static-catalog:selector:high",
  accountCapabilityRef: "openai-chatgpt:gpt-5.6-sol",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: { selectionPolicy: "exact", requestedTier: "high" },
  executorIdentityRef: "localization-production:static-catalog:selector",
  acceptanceRef: "localization-production:static-catalog",
  acceptanceVersion: "v1",
});

function candidateReceipt(input: Readonly<{
  role: CandidateRole;
  contextHash: ProductionHash;
  payloadJson: string;
}>): CandidateReceipt {
  return Object.freeze({
    role: input.role,
    context_bundle_hash: input.contextHash,
    payload_json: input.payloadJson,
    payload_hash: sha256(input.payloadJson),
  });
}

function candidatePrompt(context: SharedExecutionContext, role: CandidateRole, requestJson: string): string {
  return [context.productSkill.text, "", `当前职责：${role === "candidate_a" ? "独立候选 A" : "独立候选 B"}。`,
    "只处理下面同一份冻结请求。不得读取或猜测另一候选；不得发布、写仓库或改变源文事实。",
    "逐条生成目标 locale 的自然固定网页文案。保留全部占位符、URL、邮箱、数字百分比、标签、专名与风险强度。",
    "同时保留原典或可信来源的根位、确定事实与解释的边界、可见核验依据、当代用户问题及行动；工具只能保持源文批准的披露位置，不得升格为品牌或价值证明。",
    `触犯核心价值约束时使用对应稳定 finding_codes：${PUBLIC_VALUE_FINDING_CODES.join("、")}。`,
    "无法安全保真时仍返回机械合法文本，并在 finding_codes 写入稳定问题码；不得省略消息。",
    "冻结请求 JSON：", requestJson,
    "只返回一个 JSON 对象：schema_version=target-language-candidate.v1、locale、context_bundle_hash、items。",
    "items 必须与上下文 message_items 同顺序同数量；每项只能有 message_id、text、finding_codes。不要代码围栏。",
  ].join("\n");
}

function blindMapping(task: WebsiteAgentTask, context: ContextBundle, a: CandidateReceipt, b: CandidateReceipt): BlindMapping {
  const seed = hashCanonical({ job_id: task.job_id, batch_id: context.batch_id,
    context_bundle_hash: a.context_bundle_hash, candidate_a: a.payload_hash, candidate_b: b.payload_hash });
  const aFirst = Number.parseInt(seed.slice(7, 9), 16) % 2 === 0;
  const roles: readonly [CandidateRole, CandidateRole] = aFirst ? ["candidate_a", "candidate_b"] : ["candidate_b", "candidate_a"];
  const receipts = { candidate_a: a, candidate_b: b } as const;
  return Object.freeze({
    schema_version: "target-language-blind-mapping.v1",
    locale: context.locale,
    context_bundle_hash: a.context_bundle_hash,
    first_pass_candidates: (() => {
      const mapped = roles.map((role, index) => Object.freeze({
        blind_label: `option_${index + 1}_${hashCanonical({ seed, index }).slice(7, 19)}`,
        candidate_role: role,
        candidate_payload_hash: receipts[role].payload_hash,
      }));
      return Object.freeze([mapped[0]!, mapped[1]!] as const);
    })(),
    nonce_ref: `nonce:${seed.slice(7)}`,
  });
}

function selectorPrompt(context: SharedExecutionContext, selectorInputJson: string): string {
  return [context.productSkill.text, "", "当前职责：独立盲选器。候选身份已隐藏。不得推断生产者，不得重写任何候选文案。",
    "逐条选择更忠实、自然且完整保留来源、事实边界、核验依据、当代用途与工具从属位置的 blind_label；字节完全相同可选 identical；不能安全选择则 blocked。",
    `reason_code 必须严格按 selection 使用此唯一映射：${JSON.stringify(SELECTOR_REASON_CODES)}；blind_label 代表输入中的任一 blind_label。`,
    "冻结盲选输入 JSON：", selectorInputJson,
    "只返回一个 JSON 对象：schema_version=target-language-selector-output.v1、locale、pass=first、selections。",
    "selections 必须与上下文消息同顺序同数量；每项只能有 message_id、selection、reason_code。不要代码围栏。",
  ].join("\n");
}

type CohortResult = Readonly<{
  selected: readonly CandidateItem[];
  evidenceRefs: readonly string[];
  blocked: boolean;
}>;

type CandidateRun = Readonly<{
  candidate: CandidatePayload;
  receipt: CandidateReceipt;
  evidenceRefs: readonly string[];
}>;

async function executeCandidate(input: Readonly<{
  task: WebsiteAgentTask;
  execution: SharedExecutionContext;
  context: ContextBundle;
  cohort: StaticCohort;
  requestJson: string;
  role: CandidateRole;
}>): Promise<CandidateRun> {
  const candidateA = input.role === "candidate_a";
  const reasoningEffort = candidateA ? "xhigh" : "high";
  const turn = await executeIsolatedLocalizationJsonTurn(input.task, input.execution, {
    stepId: `${input.cohort.batch_id}:${candidateA ? "candidate-a" : "candidate-b"}`,
    sessionSuffix: `${input.cohort.batch_id}:${candidateA ? "candidate-a" : "candidate-b"}`,
    prompt: candidatePrompt(input.execution, input.role, input.requestJson),
    profile: candidateA ? candidateAProfile : candidateBProfile,
    reasoningEffort,
  });
  const candidate = parseCandidate(turn.value, input.context, input.cohort.context_bundle_hash);
  const payloadJson = JSON.stringify(candidate);
  const receipt = candidateReceipt({
    role: input.role, contextHash: input.cohort.context_bundle_hash, payloadJson,
  });
  return Object.freeze({ candidate, receipt, evidenceRefs: turn.evidenceRefs });
}

type SelectorChoice = ReturnType<typeof parseSelector>["selections"][number];

function resolveFormalSelection(
  choice: SelectorChoice,
  a: CandidateItem,
  b: CandidateItem,
  mapping: BlindMapping,
): FormalSelection {
  const labels = new Set(mapping.first_pass_candidates.map((item) => item.blind_label));
  if (!selectorReasonAllowed(choice.selection, choice.reason_code, labels)) fail("LOCALIZATION_STATIC_SELECTOR_CHOICE_INVALID");
  if (choice.selection === "identical" && a.text !== b.text) fail("LOCALIZATION_STATIC_SELECTOR_IDENTICAL_INVALID");
  if (choice.selection === "identical" || choice.selection === "blocked") return choice.selection;
  return mapping.first_pass_candidates.find((item) => item.blind_label === choice.selection)?.candidate_role
    ?? fail("LOCALIZATION_STATIC_SELECTOR_CHOICE_INVALID");
}

function formalizeSelection(input: Readonly<{
  choice: SelectorChoice;
  index: number;
  candidateA: CandidatePayload;
  candidateB: CandidatePayload;
  mapping: BlindMapping;
}>): Readonly<{ choice: Readonly<Record<string, unknown>>; selected: CandidateItem; blocked: boolean }> {
  const a = input.candidateA.items[input.index]!;
  const b = input.candidateB.items[input.index]!;
  const selection = resolveFormalSelection(input.choice, a, b, input.mapping);
  const selectedText = selection === "candidate_b" ? b.text : a.text;
  const selectedFindings = selection === "candidate_a" ? a.finding_codes
    : selection === "candidate_b" ? b.finding_codes
      : selection === "identical" && sameStrings(a.finding_codes, b.finding_codes) ? a.finding_codes : [];
  const blocked = selection === "blocked" || selectedFindings.length > 0
    || selection === "identical" && (!sameStrings(a.finding_codes, b.finding_codes) || a.finding_codes.length > 0);
  return Object.freeze({
    choice: Object.freeze({ message_id: input.choice.message_id, selection,
      ...(selection === "blocked" ? {} : { selected_text_hash: sha256(selectedText) }),
      reason_code: input.choice.reason_code }),
    selected: Object.freeze({ message_id: input.choice.message_id, text: selectedText, finding_codes: selectedFindings }),
    blocked,
  });
}

function candidateRequestJson(context: ContextBundle, cohort: StaticCohort): string {
  return JSON.stringify({
    schema_version: "target-language-candidate-request.v1",
    locale: context.locale,
    context_bundle_json: cohort.context_bundle_json,
    context_bundle_hash: cohort.context_bundle_hash,
    requirements: ["preserve-meaning-and-action", "preserve-typed-placeholders-and-protected-tokens",
      "preserve-source-fact-evidence-and-present-use", "never-promote-tools-to-public-value",
      "obey-expression-terminology-format-policies", "return-complete-denominator", "record-blocking-findings"],
  });
}

function selectorInputJson(
  context: ContextBundle,
  cohort: StaticCohort,
  mapping: BlindMapping,
  receipts: Readonly<Record<CandidateRole, CandidateReceipt>>,
): string {
  return JSON.stringify({
    schema_version: "target-language-selector-input.v1", locale: context.locale, pass: "first",
    review_instructions: ["select-one-anonymous-candidate-per-message", "never-rewrite-candidate-text",
      "use-identical-only-for-byte-identical-text", "block-when-no-safe-selection"],
    context_bundle_json: cohort.context_bundle_json,
    context_bundle_hash: cohort.context_bundle_hash,
    anonymous_candidates: mapping.first_pass_candidates.map((item) => Object.freeze({
      blind_label: item.blind_label,
      payload_json: receipts[item.candidate_role].payload_json,
      payload_hash: receipts[item.candidate_role].payload_hash,
    })),
  });
}

async function executeCohort(task: WebsiteAgentTask, execution: SharedExecutionContext,
  input: StaticCatalogInput, cohort: StaticCohort): Promise<CohortResult> {
  const context = parseContext(cohort, input);
  const requestJson = candidateRequestJson(context, cohort);
  const candidateA = await executeCandidate({ task, execution, context, cohort, requestJson, role: "candidate_a" });
  const candidateB = await executeCandidate({ task, execution, context, cohort, requestJson, role: "candidate_b" });
  const mapping = blindMapping(task, context, candidateA.receipt, candidateB.receipt);
  const receipts = { candidate_a: candidateA.receipt, candidate_b: candidateB.receipt } as const;
  const frozenSelectorInput = selectorInputJson(context, cohort, mapping, receipts);
  const selectorTurn = await executeIsolatedLocalizationJsonTurn(task, execution, {
    stepId: `${cohort.batch_id}:selector`, sessionSuffix: `${cohort.batch_id}:selector`,
    prompt: selectorPrompt(execution, frozenSelectorInput), profile: selectorProfile, reasoningEffort: "high",
  });
  const selectorOutput = parseSelector(selectorTurn.value, context, mapping);
  const formalSelections = selectorOutput.selections.map((choice, index) => formalizeSelection({
    choice, index, candidateA: candidateA.candidate, candidateB: candidateB.candidate, mapping,
  }));
  const blocked = formalSelections.some((item) => item.blocked);
  const selectedPayload: CandidatePayload = Object.freeze({
    schema_version: "target-language-candidate.v1", locale: context.locale,
    context_bundle_hash: cohort.context_bundle_hash,
    items: Object.freeze(formalSelections.map((item) => item.selected)),
  });
  return Object.freeze({ selected: selectedPayload.items,
    evidenceRefs: Object.freeze([...candidateA.evidenceRefs, ...candidateB.evidenceRefs, ...selectorTurn.evidenceRefs]),
    blocked });
}

export const executeStaticCatalogFlow = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
) => {
  if (task.product_id !== "localization_static_catalog" || task.action_id !== "produce_locale_catalog"
    || context.materials.length !== 1 || context.materials[0]?.role !== "static_catalog_input") {
    fail("LOCALIZATION_STATIC_OWNER_MISMATCH");
  }
  const material = context.materials[0]!;
  const bytes = await readFile(material.local_path);
  if (bytes.byteLength !== material.bytes || sha256(bytes) !== material.sha256) fail("LOCALIZATION_STATIC_MATERIAL_MISMATCH");
  const input = parseInput(JSON.parse(bytes.toString("utf8")) as unknown, task);
  const results: Awaited<ReturnType<typeof executeCohort>>[] = [];
  for (const cohort of input.context_bundles) results.push(await executeCohort(task, context, input, cohort));
  const selectedMessages = Object.freeze(results.flatMap((result) => result.selected));
  const payload = Object.freeze({
    schema_version: "localization-static-catalog-result.v2",
    action_id: "localization_static_catalog",
    source_resource_id: input.source_resource_id,
    source_version: input.source_version,
    source_sha256: input.source_sha256,
    target_locale: input.target_locale,
    policy_version: input.policy_version,
    message_count: selectedMessages.length,
    selected_messages: selectedMessages,
    selected_catalog_hash: hashCanonical(selectedMessages),
    decision: results.some((result) => result.blocked) ? "blocked" : "production_approved",
  });
  if (payload.message_count !== input.expected_message_count) fail("LOCALIZATION_STATIC_RESULT_DENOMINATOR_INVALID");
  return context.complete({ payload,
    evidence_refs: Object.freeze(results.flatMap((result) => result.evidenceRefs)) });
};
