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
const IDENTITY_FILES = ["01_身份与约束.json", "03_问题与原始输入.json"];
const PAGED_SECTIONS = ["02_盘局", "02_候选", "04_规则矩阵", "04_候选", "05_语义清单"];
const NAVIGATION_FRAGMENTS = ["奇门问事资料/01_身份与约束.json", "02_盘局/候选全部页", "04_规则矩阵/候选全部页", "05_语义清单全部页"];
const assertNavigation = (prompt: string): void => {
  for (const part of ["00_资料目录.json", "record_pages", "原文.md与索引.json", ...NAVIGATION_FRAGMENTS]) {
    assert.ok(prompt.includes(part), `current Product navigation missing: ${part}`);
  }
};
const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "qimen-professional-answer");
assert(plugin);
const skillText = readFileSync(new URL("../../../src/plugins/qimen-professional-answer/SKILL.md", import.meta.url), "utf8");
const initial = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;

for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const fixture = review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核奇门事实" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { result_schema_version: route.result_schema_version, report_id: "report:1", chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    question_snapshot: { question_ref: "question:1", original_text: "是否继续合作？", unit_refs: ["question-unit:1"] },
    answer_blocks: [{ block_id: "block:1", reasoning_kind: "synthesis", candidate_scope: "all",
      semantic_anchor_refs: ["anchor:1"], evidence_refs: ["citation:1"], citation_ids: ["citation:1"],
      question_unit_refs: ["question-unit:1"], professional_markdown: "专业层", reader_explanation_markdown: "读者层" }],
    index_review_receipts: [{ book_id: "book:1", index_hash: FIXTURE_HASH, macro_entry_count: 1,
      navigation_node_count: 1, semantic_entry_count: 1, review_status: "complete", applicability_note: "已审阅" }],
    covered_question_unit_refs: ["question-unit:1"], covered_candidate_refs: ["candidate:1"],
    citations: [{ citation_id: "citation:1", source_kind: "user_input", evidence_relation: "limits",
      candidate_refs: [], source_ref: "question:1", locator: "question-unit:1", title: "问题", quote: "是否继续合作？",
      source_identity_hashes: { question_snapshot_hash: FIXTURE_HASH } }],
    uncertainties: [], limitations: [], safety_notes: ["不替代现实专业服务。"],
  };
  const run = await exerciseProductFlow(plugin, { task, output, productSkillText: skillText, materialContents: zipMaterials(task, route) });
  await exerciseConfirmedSubmitRecovery(plugin, { task, output, productSkillText: skillText, materialContents: zipMaterials(task, route) });
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "qimen-professional-answer:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map((call) => call.child), initial);
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.match(prompt, /当前 Product Plugin：qimen-professional-answer/u);
  assert.match(prompt, /question snapshot、全部 question unit、全部 candidate、anchor manifest、rule evaluation matrix 和全部 READY books\/receipt denominator/u);
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
    for (const part of NAVIGATION_FRAGMENTS) assert.throws(() => assertNavigation(actualPrompt.replace(part, "")));
    assert.ok(route.material_roles.every(row => row.role !== "result_contract"));
  }
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][qimen-professional-answer] PASS\n");
