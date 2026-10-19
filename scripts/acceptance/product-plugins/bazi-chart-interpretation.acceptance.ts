import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import { productResultValidation, type WebsiteAgentTask } from "../../../src/mediator/product-plugin-contract.js";
import { parseProductResult } from "../../../src/plugins/bazi-chart-interpretation/result-contract.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";

const zipMaterials = (task: WebsiteAgentTask, route: (typeof productionRoutePolicies)[number]): Record<string, Uint8Array> => {
  if (route.relation_kind === "review") return {};
  return Object.fromEntries(route.material_roles.map(row => {
    const corpus = row.role === "ready_corpus_archive";
    const root = corpus ? "八字古籍资料" : FACT_ROOT;
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
const FACT_ROOT = "八字命盘资料";
const IDENTITY_FILES = ["01_身份与来源.json"];
const PAGED_SECTIONS = ["00_解读入口", "01_完整命盘事实", "02_PDF对象与绑定", "03_完整核验底稿"];
const NAVIGATION_FRAGMENTS = ["00_解读入口", "01_完整命盘事实", "02_PDF对象与绑定", "03_完整核验底稿", "事实语义清单", "没有额外咨询问题"];
const assertNavigation = (prompt: string): void => {
  for (const part of ["00_资料目录.json", "record_pages", "原文.md", "索引.json", ...NAVIGATION_FRAGMENTS]) {
    assert.ok(prompt.includes(part), `current Product navigation missing: ${part}`);
  }
};
const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "bazi-chart-interpretation");
assert(plugin);
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  if (route.relation_kind === "review") {
    const review = route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核八字解读" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const };
    const task = buildProductTask(route, review);
    const flowFixture = { task, output: { decision: "no_issue", issues: [] } };
    const issue = { observation: "e\u0301𠮷", extra: { untouched: true } };
    assert.deepEqual(parseProductResult(task, { decision: "issues", issues: issue, extra: true }, route),
      { decision: "issues", issues: [issue], extra: true });
    assert.throws(() => parseProductResult(task, { decision: "invalid", issues: [] }, route), /AGENT_REVIEW_DECISION_INVALID/u);
    const run = await exerciseProductFlow(plugin, flowFixture);
    await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
    const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
    const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
    assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
      startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
      requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
      profileRef: "bazi-chart-interpretation:chatgpt-latest-reasoning-4",
      startModelDisplayName: "最新", requestedReasoningValue: 4,
    });
    assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
    assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
    continue;
  }
  const task = buildProductTask(route, { privacySubjectRef: "privacy-subject:1", parameters: {
    analysis_kind: "chart_interpretation", result_schema_version: route.result_schema_version,
    chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH,
    current_authorization_ref: "authorization:1", owner_scope_hash: FIXTURE_HASH_B,
    consultation_root_ref: "source:bazi_chart_interpretation:produce",
    fact_semantic_manifest_ref: "manifest:1",
    fact_semantic_manifest_hash: FIXTURE_HASH,
  } });
  const output = {
    schema_version: route.result_schema_version,
    report_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    interpretation_blocks: [{ block_id: "one", professional_markdown: "# 自主标题\n专业层", reader_explanation_markdown: "# 自主标题\n读者层", semantic_anchor_refs: ["anchor:1"], condition_scope: { kind: "all_provided_conditions" }, evidence_refs: [], citation_ids: [] }], chart_ref: task.parameters.chart_ref,
    chart_version: task.parameters.chart_version, chart_hash: task.parameters.chart_hash,
    fact_semantic_manifest_ref: "manifest:1", manifest_hash: FIXTURE_HASH,
    covered_semantic_anchor_refs: ["anchor:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  assert.deepEqual(parseProductResult(task, productResultValidation.parseJsonObject("```json\n" + JSON.stringify(output) + "\n```", "OUTPUT"), route), output);
  assert.throws(() => productResultValidation.parseJsonObject(JSON.stringify(output) + "\n{}", "OUTPUT"), /JSON_AMBIGUOUS/u);
  assert.deepEqual(parseProductResult(task, output, route), output);
  const repeated = { ...output, interpretation_blocks: [...output.interpretation_blocks, { ...output.interpretation_blocks[0], block_id: "two", professional_markdown: "# 交叉综合\n同一命盘对象可再次参与综合解释。" }] };
  assert.equal((parseProductResult(task, repeated, route).interpretation_blocks as unknown[]).length, 2);
  {
    const rawText = "  e\u0301𠮷🌙\n原文  ";
    const extra = { rawText, nested: ["first", { last: rawText }] };
    const received = parseProductResult(task, { ...output, uncertainties: rawText, limitations: rawText,
      safety_notes: rawText, provider_extra: extra }, route);
    for (const field of ["uncertainties", "limitations", "safety_notes"]) assert.deepEqual(received[field], [rawText]);
    assert.deepEqual(received.provider_extra, extra);
    assert.throws(() => parseProductResult(task, { ...output, schema_version: "wrong" }, route), /SCHEMA_VERSION_INVALID/u);
    for (const key of ["chart_ref", "chart_version", "chart_hash", "fact_semantic_manifest_ref", "manifest_hash"]) {
      assert.throws(() => parseProductResult(task, { ...output, [key]: "foreign" }, route), /LOCK_INVALID|LOCKED_IDENTITY_INVALID|SNAPSHOT/u);
    }
    assert.throws(() => parseProductResult({ ...task, product_id: "foreign" }, output, route), /PRODUCT_RESULT_OWNER_MISMATCH/u);
    assert.throws(() => parseProductResult(task, output, { ...route, action_id: "foreign" }), /PRODUCT_RESULT_OWNER_MISMATCH/u);
  }
  const flowFixture = {
    task, output, materialContents: zipMaterials(task, route),
  };
  const run = await exerciseProductFlow(plugin, flowFixture);
  await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
  const actualPrompt = String(run.calls.find(call => call.child === "write_exact_gpt_prompt")!.input.prompt);
  const contractLines = actualPrompt.split("\n").filter(line => line.startsWith("当前 canonical 输出合同："));
  assert.equal(contractLines.length, 1);
  assert.deepEqual(JSON.parse(contractLines[0]!.slice("当前 canonical 输出合同：".length)), route.result_contract);
  assert.ok(actualPrompt.includes("直接在消息正文交付一个完整 JSON 对象"));
  {
    assertNavigation(actualPrompt);
    assert.ok(route.material_roles.every(row => row.role !== "result_contract"));
  }
  assert.equal(run.physicalSubmitDispatches, 1);
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "bazi-chart-interpretation:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
}
process.stdout.write("[ACCEPTANCE][bazi-chart-interpretation] PASS\n");
