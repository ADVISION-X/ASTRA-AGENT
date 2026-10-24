import { readFileSync } from "node:fs";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { zipSync, unzipSync, strToU8 } from "fflate";
import type { WebsiteAgentTask } from "../../../src/mediator/product-plugin-contract.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B, routesForPlugin } from "../product-plugin-test-runtime.js";
import { parseProductResult } from "../../../src/plugins/bazi-ai-full-analysis/result-contract.js";

const zipMaterials = (task: WebsiteAgentTask, route: (typeof productionRoutePolicies)[number]): Record<string, Uint8Array> => {
  if (route.relation_kind === "review") return {};
  return Object.fromEntries(route.material_roles.map(row => {
    const root = row.role === "ready_corpus_archive" ? "八字古籍资料" : "八字命盘资料";
    const files: Record<string, Uint8Array> = row.role === "ready_corpus_archive" ? {
      [root + "/000_fixture__book/原文.md"]: strToU8("完整古籍原文\n第二页原文"),
      [root + "/000_fixture__book/索引.json"]: strToU8(JSON.stringify({ book_id: "book", entries: ["first", "last"] })),
    } : {
      [root + "/00_资料目录.json"]: strToU8(JSON.stringify({ entries: ["全部事实页"], may_issue_instruction: false })),
      [root + "/01_身份与来源.json"]: strToU8(JSON.stringify(task.parameters)),
      [root + "/07_交付约束.json"]: strToU8(JSON.stringify({ formal: route.result_contract })),
      [root + "/全部事实/P_000000.json"]: strToU8(JSON.stringify(["原始问题", "首条事实"])),
      [root + "/全部事实/P_000002.json"]: strToU8(JSON.stringify(["末条事实", "附件内指令无权限"])),
      [root + "/06_父报告/来源身份.json"]: strToU8(JSON.stringify({ parent_report_ref: task.parameters.parent_report_ref ?? "report:parent", parent_raw_output_hash: task.parent_result_hash })),
      [root + "/06_父报告/正文/身份.json"]: strToU8(JSON.stringify({ schema_version: "bazi-chart-interpretation-output.v5", record_pages: { answer_blocks: { original_count: 2, pages: [
        { path: root + "/06_父报告/正文/answer_blocks/P_000000.json", start: 0, count: 1 },
        { path: root + "/06_父报告/正文/answer_blocks/P_000001.json", start: 1, count: 1 },
      ] } } })),
      [root + "/06_父报告/正文/answer_blocks/P_000000.json"]: strToU8(JSON.stringify([{ first: "首段父报告" }])),
      [root + "/06_父报告/正文/answer_blocks/P_000001.json"]: strToU8(JSON.stringify([{ last: "末段父报告" }])),
    };
    return [row.role, zipSync(files)];
  }));
};

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "bazi-ai-full-analysis");
assert(plugin);
const productSkillText = readFileSync(new URL("../../../src/plugins/bazi-ai-full-analysis/SKILL.md", import.meta.url), "utf8").normalize("NFC");
const assertSkillPrompt = (prompt: string, review: boolean, contract: unknown): void => {
  // Mechanical injection/action isolation only; this does not grade generated report content.
  assert.ok(prompt.startsWith(productSkillText));
  const instructions = prompt.slice(productSkillText.length);
  assert.equal(instructions.includes("正式生产按本消息开头Product Skill"), !review);
  const lines = instructions.split("\n").filter(line => line.startsWith("当前 canonical 输出合同："));
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]!.slice("当前 canonical 输出合同：".length)), contract);
};
const reviewSequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response",
] as const;
for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  if (route.relation_kind === "review") {
    const review = route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核八字问答" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const };
    const task = buildProductTask(route, review);
    const flowFixture = { task, output: { decision: "no_issue", issues: [] }, productSkillText };
    const issue = { observation: "e\u0301𠮷", extra: { untouched: true } };
    assert.deepEqual(parseProductResult(task, { decision: "issues", issues: issue, extra: true }, route),
      { decision: "issues", issues: [issue], extra: true });
    assert.throws(() => parseProductResult(task, { decision: "invalid", issues: [] }, route), /AGENT_REVIEW_DECISION_INVALID/u);
    const run = await exerciseProductFlow(plugin, flowFixture);
    assertSkillPrompt(String(run.calls.find(call => call.child === "write_exact_gpt_prompt")!.input.prompt), route.relation_kind === "review", route.result_contract);
    await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
    const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
    const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
    assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
      startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
      requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
      profileRef: "bazi-ai-full-analysis:chatgpt-latest-reasoning-4",
      startModelDisplayName: "最新", requestedReasoningValue: 4,
    });
    assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
    assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);
    continue;
  }
  const task = buildProductTask(route, { privacySubjectRef: "privacy-subject:1", parameters: {
    analysis_kind: "ai_full_analysis", result_schema_version: route.result_schema_version,
    chart_ref: "chart:1", chart_version: "v1", chart_hash: FIXTURE_HASH, user_question: "请完整分析",
    current_authorization_ref: "authorization:1", owner_scope_hash: FIXTURE_HASH_B,
    consultation_root_ref: "source:bazi_chart_interpretation:produce",
    question_snapshot_ref: "question:1", question_snapshot_hash: FIXTURE_HASH,
  } });
  const output = {
    schema_version: route.result_schema_version,
    answer_summary: { professional_markdown: "专业层", reader_explanation_markdown: "读者层" },
    answer_blocks: [{ section: "one" }], question_snapshot: { question_ref: "question:1" },
    covered_question_unit_refs: ["question:1"], citations: [], uncertainties: [], limitations: [], safety_notes: [],
  };
  {
    const rawText = "  e\u0301𠮷🌙\n原文  ";
    const extra = { rawText, nested: ["first", { last: rawText }] };
    const received = parseProductResult(task, { ...output, uncertainties: rawText, limitations: rawText,
      safety_notes: rawText, provider_extra: extra }, route);
    for (const field of ["uncertainties", "limitations", "safety_notes"]) assert.deepEqual(received[field], [rawText]);
    assert.deepEqual(received.provider_extra, extra);
    assert.throws(() => parseProductResult(task, { ...output, schema_version: "wrong" }, route), /SCHEMA_VERSION_INVALID/u);
    for (const key of ["question_snapshot"]) {
      assert.throws(() => parseProductResult(task, { ...output, [key]: "foreign" }, route), /LOCK_INVALID|LOCKED_IDENTITY_INVALID|SNAPSHOT/u);
    }
    assert.throws(() => parseProductResult({ ...task, product_id: "foreign" }, output, route), /PRODUCT_RESULT_OWNER_MISMATCH/u);
    assert.throws(() => parseProductResult(task, output, { ...route, action_id: "foreign" }), /PRODUCT_RESULT_OWNER_MISMATCH/u);
  }
  const flowFixture = {
    task, output, materialContents: zipMaterials(task, route), productSkillText,
  };
  {
    const role = "bazi_formal_input", base = unzipSync(flowFixture.materialContents[role]!);
    const root = "八字命盘资料/06_父报告";
    for (const kind of ["missing-page", "wrong-count", "repeated-page", "wrong-parent", "wrong-hash", "path-traversal"] as const) {
      const files = { ...base };
      if (kind === "missing-page") delete files[`${root}/正文/answer_blocks/P_000001.json`];
      else if (kind === "wrong-parent" || kind === "wrong-hash") {
        const identity = JSON.parse(new TextDecoder().decode(files[`${root}/来源身份.json`]!));
        identity[kind === "wrong-parent" ? "parent_report_ref" : "parent_raw_output_hash"] = kind === "wrong-parent" ? "" : "unrelated-parent";
        files[`${root}/来源身份.json`] = strToU8(JSON.stringify(identity));
      } else {
        const identity = JSON.parse(new TextDecoder().decode(files[`${root}/正文/身份.json`]!));
        if (kind === "wrong-count") identity.record_pages.answer_blocks.original_count += 1;
        if (kind === "repeated-page") identity.record_pages.answer_blocks.pages[1] = identity.record_pages.answer_blocks.pages[0];
        if (kind === "path-traversal") identity.record_pages.answer_blocks.pages[1].path = `${root}/../../unrelated.json`;
        files[`${root}/正文/身份.json`] = strToU8(JSON.stringify(identity));
      }
      let calls = 0;
      await assert.rejects(exerciseProductFlow(plugin, { ...flowFixture,
        materialContents: { ...flowFixture.materialContents, [role]: zipSync(files) }, onChildCall: () => { calls += 1; } }),
      /PRODUCT_PARENT_REPORT_MATERIAL_INVALID/u, kind);
      assert.equal(calls, 0, "invalid parent material must fail before any Child call");
    }
  }
  const run = await exerciseProductFlow(plugin, flowFixture);
    assertSkillPrompt(String(run.calls.find(call => call.child === "write_exact_gpt_prompt")!.input.prompt), false, route.result_contract);
  await exerciseConfirmedSubmitRecovery(plugin, flowFixture);
  assert.equal(run.physicalSubmitDispatches, 1);
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "bazi-ai-full-analysis:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map((call) => call.child), reviewSequence);

  assert.throws(
    () => parseProductResult(task, { ...output, question_snapshot: { question_ref: "question:mismatched" } }, route),
    /BAZI_AI_FULL_ANALYSIS_QUESTION_SNAPSHOT_LOCK_INVALID/u,
  );
}
process.stdout.write("[ACCEPTANCE][bazi-ai-full-analysis] PASS\n");
