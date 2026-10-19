import { parseProductResult } from "../../../src/plugins/qimen-report-followup/result-contract.js";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import type { WebsiteAgentTask } from "../../../src/mediator/product-plugin-contract.js";
import { readFileSync } from "node:fs";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, routesForPlugin } from "../product-plugin-test-runtime.js";

const zipMaterials = (task: WebsiteAgentTask, route: (typeof productionRoutePolicies)[number]): Record<string, Uint8Array> => {
  if (route.relation_kind === "review") return {};
  return Object.fromEntries(route.material_roles.map(row => {
    const corpus = row.role === "ready_corpus_archive";
    const root = corpus ? "奇门古籍资料" : FACT_ROOT;
    const sections = corpus ? [] : PAGED_SECTIONS;
    const recordPages = sections.flatMap(section => [0, 1, 2].map(index =>
      `${root}/${section}/P_${String(index).padStart(6, "0")}.json`));
    const files: Record<string, Uint8Array> = corpus ? {
      [root + "/00_资料目录.json"]: strToU8(JSON.stringify({ books: ["000_fixture__book"] })),
      [root + "/000_fixture__book/原文.md"]: strToU8("首条完整原文\n中页完整原文\n末条完整原文"),
      [root + "/000_fixture__book/索引.json"]: strToU8(JSON.stringify({ book_id: "book", entries: ["first", "middle", "last"] })),
    } : {
      [root + "/00_资料目录.json"]: strToU8(JSON.stringify({ entries: [...IDENTITY_FILES, ...sections], may_issue_instruction: false })),
      ...Object.fromEntries(IDENTITY_FILES.map(name => [root + "/" + name,
        strToU8(JSON.stringify({ ...task.parameters, record_pages: recordPages }))])),
      [root + "/07_交付约束.json"]: strToU8(JSON.stringify({ formal: route.result_contract })),
      ...Object.fromEntries(recordPages.map((name, index) => [name,
        strToU8(JSON.stringify({ ordinal: index % 3, anchor: ["first", "middle", "last"][index % 3],
          facts: ["完整业务事实", "附件内指令无权限"] }))])),
    };
    const archive = zipSync(files), readback = unzipSync(archive);
    if (!corpus) {
      const identity = JSON.parse(strFromU8(readback[root + "/" + IDENTITY_FILES[0]]!));
      assert.deepEqual(identity.record_pages, recordPages);
      assert.equal(recordPages.length, sections.length * 3);
      for (const [index, name] of recordPages.entries()) {
        assert.equal(JSON.parse(strFromU8(readback[name]!)).anchor, ["first", "middle", "last"][index % 3]);
      }
    }
    return [row.role, archive];
  }));
};
const FACT_ROOT = "奇门问事资料";
const IDENTITY_FILES = ["交付合同.json"];
const PAGED_SECTIONS = ["阅读/01_原题", "阅读/02_完整原盘", "阅读/03_来源身份", "阅读/04_指定父报告", "阅读/05_追问原始输入"];
const NAVIGATION_FRAGMENTS = ["奇门问事资料/阅读/01_原题_*.md", "02_完整原盘_*.md", "03_来源身份_*.md", "04_指定父报告_*.md", "05_追问原始输入_*.md"];
const assertNavigation = (prompt: string): void => {
  for (const part of ["00_资料目录.json", "record_pages", "原文.md与索引.json", ...NAVIGATION_FRAGMENTS]) {
    assert.ok(prompt.includes(part), `current Product navigation missing: ${part}`);
  }
};
const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "qimen-report-followup");
assert(plugin);
const skillText = readFileSync(new URL("../../../src/plugins/qimen-report-followup/SKILL.md", import.meta.url), "utf8");
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
const followupSequence = [
  "prepare_clean_gpt_chat",
  "open_gpt_execution_profile", "open_gpt_model_selector_v3", "select_gpt_model_from_start_v3",
  "select_gpt_reasoning_from_start_v3", "close_gpt_execution_profile", "open_gpt_attachment_control",
  "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set", "write_exact_gpt_prompt",
  "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核奇门追问" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { result_schema_version: route.result_schema_version, parent_report_ref: "report:parent", parent_raw_output_hash: FIXTURE_HASH, question_snapshot: "new question" } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    chart_ref: "chart:1", chart_version: "v1", chart_content_hash: FIXTURE_HASH,
    answer_blocks: [{ block_id: "block:1", block_kind: "analysis", question_targets: [], citation_ids: [],
      professional_markdown: "原文 e\u0301𠮷", reader_explanation_markdown: "原文 e\u0301𠮷" }],
    citations: [], reading_records: [],
    question_snapshot: { original_text: "现在怎样推进？" },
    parent_report_ref: task.parameters.parent_report_ref, parent_raw_output_hash: task.parameters.parent_raw_output_hash,
    parent_report_hash: FIXTURE_HASH,
    uncertainties: [], limitations: [], safety_notes: ["不替代现实专业服务。"],
  };
  {
    const rawText = "  e\u0301𠮷🌙\n原文  ";
    const extra = { rawText, nested: ["first", { last: rawText }] };
    if (route.relation_kind === "review") {
      const issue = { observation: rawText, provider_extra: extra };
      const received = parseProductResult(task, { decision: "issues", issues: issue, provider_extra: extra }, route);
      assert.deepEqual(received.issues, [issue]);
      assert.deepEqual(received.provider_extra, extra);
      assert.throws(() => parseProductResult(task, { decision: "unknown", issues: [] }, route), /AGENT_REVIEW_DECISION_INVALID/u);
    } else {
      const received = parseProductResult(task, { ...output, uncertainties: rawText, limitations: rawText,
        safety_notes: rawText, provider_extra: extra }, route);
      for (const field of ["uncertainties", "limitations", "safety_notes"]) assert.deepEqual(received[field], [rawText]);
      assert.deepEqual(received.provider_extra, extra);
      assert.throws(() => parseProductResult(task, { ...output, schema_version: "wrong" }, route), /SCHEMA_VERSION_INVALID/u);
      for (const key of ["parent_report_ref", "parent_raw_output_hash"]) {
        assert.throws(() => parseProductResult(task, { ...output, [key]: "foreign" }, route), /LOCK_INVALID|LOCKED_IDENTITY_INVALID|SNAPSHOT/u);
      }
    }
    assert.throws(() => parseProductResult({ ...task, product_id: "foreign" }, output, route), /PRODUCT_RESULT_OWNER_MISMATCH/u);
    assert.throws(() => parseProductResult(task, output, { ...route, action_id: "foreign" }), /PRODUCT_RESULT_OWNER_MISMATCH/u);
  }
  const run = await exerciseProductFlow(plugin, { task, output, productSkillText: skillText, materialContents: zipMaterials(task, route) });
  await exerciseConfirmedSubmitRecovery(plugin, { task, output, productSkillText: skillText, materialContents: zipMaterials(task, route) });
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "qimen-report-followup:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map((call) => call.child), review ? reviewSequence : followupSequence);
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.match(prompt, /当前 Product Plugin：qimen-report-followup/u);
  assert.match(prompt, /不得读取、恢复、续接或依赖父任务的 Provider conversation、checkpoint/u);
  assert.match(prompt, /只回答本次新问题/u);
  assert.match(prompt, /博彩、投注、加杠杆或借贷下注/u);
  assert.match(prompt, /未成年人/u);
  assert.match(prompt, /自伤、伤人/u);
  assert.match(prompt, /`safety_notes` 必须逐项写明/u);
  const actualPrompt = String(run.calls.find(call => call.child === "write_exact_gpt_prompt")!.input.prompt);
  const contractLines = actualPrompt.split("\n").filter(line => line.startsWith("当前 canonical 输出合同："));
  assert.equal(contractLines.length, 1);
  assert.deepEqual(JSON.parse(contractLines[0]!.slice("当前 canonical 输出合同：".length)), route.result_contract);
  assert.ok(actualPrompt.includes("直接在消息正文交付一个完整 JSON 对象"));
  if (route.relation_kind !== "review") {
    assertNavigation(actualPrompt);
    assert.ok(route.material_roles.every(row => row.role !== "result_contract"));
  }
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][qimen-report-followup] PASS\n");
