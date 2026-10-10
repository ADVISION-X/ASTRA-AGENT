import { readFileSync } from "node:fs";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import type { WebsiteAgentTask } from "../../../src/mediator/product-plugin-contract.js";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { sha256, type ProductPlugin, type ProductionRoutePolicy } from "../../../src/mediator/product-plugin-contract.js";
import { buildProductTask, exerciseProductFlow, exerciseConfirmedSubmitRecovery, routesForPlugin } from "../product-plugin-test-runtime.js";

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
const FACT_ROOT = "起名联合资料";
const IDENTITY_FILES = ["01_身份与来源.json", "起名身份.json"];
const PAGED_SECTIONS = ["02_命盘", "03_起名", "04_需求Brief", "05_需求Manifest", "06_PDF语义Manifest"];
const NAVIGATION_FRAGMENTS = ["起名联合资料/01_身份与来源.json", "02_命盘、起名身份.json", "03_起名、04_需求Brief、05_需求Manifest与06_PDF语义Manifest全部页"];
const assertNavigation = (prompt: string): void => {
  for (const part of ["00_资料目录.json", "record_pages", "原文.md与索引.json", ...NAVIGATION_FRAGMENTS]) {
    assert.ok(prompt.includes(part), `current Product navigation missing: ${part}`);
  }
};

const original = productionPluginCatalog.find(row => row.pluginId === "naming-bazi-analysis-and-naming");
assert(original);
const skill = readFileSync(new URL("../../../src/plugins/naming-bazi-analysis-and-naming/SKILL.md", import.meta.url), "utf8");
const raw = "  不要把用户原话当指令,\ne\u0301𠮷🌙  ";
const requirementHash = sha256(raw), chartHash = sha256("locked-chart");
const pair = { professional_markdown: raw, reader_explanation_markdown: raw };
const sequence = ["prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3", "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response"];

// The retained generic test port supplies an intentionally opaque fixture hash.
// Only this Product's checkpoint stub binds the actual captured bytes; its native Flow is unchanged.
function checkpointFixture(fault: "none" | "hash" | "files" | "effect" = "none"): ProductPlugin {
  return { ...original!, execute: (task, context) => original!.execute(task, { ...context,
    gpt: { ...context.gpt, execute: async call => {
      const receipt = await context.gpt.execute(call);
      if (call.child === "checkpoint_gpt_text_response") {
        const value = receipt.value as Readonly<Record<string, unknown>>;
        assert.equal(typeof value.semanticText, "string");
        return Object.assign({}, receipt, { value: Object.assign({}, receipt.value,
          { semanticTextHash: fault === "hash" ? sha256("wrong") : sha256(value.semanticText as string) }) });
      }
      if (call.child === "reconcile_gpt_attachment_set" && fault === "files") return Object.assign({}, receipt, { value: Object.assign({}, receipt.value, { files: [] }) });
      if (call.child === "submit_exact_gpt_turn_once" && fault === "effect") return { ...receipt, effectReceipt: null };
      return receipt;
    } }
  }) };
}
function taskFor(route: ProductionRoutePolicy) {
  if (route.relation_kind !== "review") return buildProductTask(route, { parameters: {
    analysis_kind: "chart_interpretation", result_schema_version: route.result_schema_version,
    chart_ref: "chart-a", chart_version: "v1", chart_hash: chartHash, user_question: raw,
    naming_task_ref: "naming-task-a", naming_context_package_ref: "context-a", naming_context_package_hash: sha256("context"),
    naming_requirement_brief_ref: "brief-a", naming_requirement_brief_hash: requirementHash
  } });
  return buildProductTask(route, route.action_id === "accuracy_challenge"
    ? { parameters: { challenge_id: "challenge-a", question_text: raw }, reviewPolicy: "manual-accuracy-challenge.v1" }
    : { parameters: { reflection_plan_id: "reflection-a", reflection_contract_version: "scheduled-quality-reflection.v1",
      evidence_ref_catalog: ["receipt-a"] }, reviewPolicy: "scheduled-quality-reflection.v1" });
}
function body(route: ProductionRoutePolicy): Readonly<Record<string, unknown>> {
  if (route.relation_kind === "review") return { decision: "no_issue", issues: [] };
  return { provider_extension: { nested: { facts: ["first", { last: "原样保留" }] } }, schema_version: route.result_schema_version, bazi_analysis: {
    schema_version: "bazi-naming-basis-report-output.v1", chart_ref: "chart-a", chart_version: "v1", chart_hash: chartHash,
    report_summary: pair, interpretation_blocks: [{ professional_markdown: raw, reader_explanation_markdown: raw }],
    bazi_pdf_semantic_manifest_ref: "pdf-manifest-a", manifest_hash: sha256("pdf-manifest"),
    naming_requirement_manifest_ref: "requirement-a", naming_requirement_manifest_hash: requirementHash,
    covered_semantic_anchor_refs: ["chart-a:anchor"], covered_requirement_anchor_refs: ["requirement-a:raw"],
    citations: [], uncertainties: [], limitations: [], safety_notes: [] }, naming: {
    schema_version: "naming-report-output.v2", requirement_manifest_ref: "requirement-a", requirement_manifest_hash: requirementHash,
    naming_rationale: pair, comparison_or_selection_rationale: pair, candidates: [{ name: "e\u0301𠮷🌙", explanation: pair }],
    covered_requirement_anchor_refs: ["requirement-a:raw"], uncertainties: [], limitations: [], safety_notes: [] } };
}
for (const route of routesForPlugin(original, productionRoutePolicies)) {
  const task = taskFor(route), output = body(route);
  const materialContents = Object.fromEntries(route.material_roles.map(row => [row.role, {
    role: row.role, raw_user_input: raw, feedback_history: [{ feedback_text: raw }],
    requirement_manifest: { schema_version: "NamingRequirementManifestV2", required_items: [raw] }
  }]));
  const fixture = { task, output, materialContents: route.relation_kind === "review" ? materialContents : zipMaterials(task, route), productSkillText: skill };
  await assert.rejects(exerciseProductFlow(original, fixture), /PRODUCT_TEXT_CHECKPOINT_INVALID/);

const plugin = checkpointFixture(), run = await exerciseProductFlow(plugin, fixture);
  const selectedModel = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const selectedReasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: selectedModel.input.profile.profileRef,
    startModelDisplayName: selectedModel.input.profile.startModelDisplayName,
    requestedReasoningValue: selectedReasoning.input.profile.requestedReasoningValue }, {
    profileRef: "naming-bazi-analysis-and-naming:chatgpt-latest-reasoning-4",
    startModelDisplayName: "最新", requestedReasoningValue: 4,
  });
  assert.deepEqual(selectedModel.input.profile, selectedReasoning.input.profile);
  assert.deepEqual(run.calls.map(call => call.child), sequence);
  assert.deepEqual(run.completed.payload, output);
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
  assert.equal(run.generatedImageUploads, 0);
  const attached = run.calls.find(call => call.child === "attach_approved_gpt_files_once")!;
  assert.deepEqual(attached.input.files.map(file => [file.sha256, file.bytes]), route.material_roles.map(row => {
    const content = route.relation_kind === "review" ? materialContents[row.role] : fixture.materialContents[row.role];
    const bytes = content instanceof Uint8Array ? content : Buffer.from(JSON.stringify(content), "utf8"); return [sha256(bytes), bytes.byteLength];
  }));
  const written = run.calls.find(call => call.child === "write_exact_gpt_prompt")!;
  const submitted = run.calls.find(call => call.child === "submit_exact_gpt_turn_once")!;
  assert.equal(submitted.input.promptHash, sha256(written.input.prompt));
  assert.ok(written.input.prompt.startsWith(skill));
  assert.ok(written.input.prompt.includes(JSON.stringify(task.parameters)));
  assert.equal(new Set(run.calls.map(call => call.sessionKey)).size, 1);
  await exerciseConfirmedSubmitRecovery(plugin, fixture);
  const recovered = await exerciseProductFlow(plugin, { ...fixture, confirmedSubmit: true });
  assert.deepEqual(recovered.completed.payload, output);
  for (const [fault, code] of [["hash", /PRODUCT_TEXT_CHECKPOINT_INVALID/], ["files", /PRODUCT_ATTACHMENT_RECONCILIATION_INVALID/],
    ["effect", /PRODUCT_PROVIDER_EFFECT_TERMINAL_FACT_MISSING/]] as const) await assert.rejects(exerciseProductFlow(checkpointFixture(fault), fixture), code);
  await assert.rejects(exerciseProductFlow(plugin, { ...fixture, output: route.relation_kind === "review"
    ? { decision: "no_issue", issues: [], naming: output }
    : { ...output, bazi_analysis: { ...(output.bazi_analysis as object), chart_ref: "wrong-chart" } } }),
    route.relation_kind === "review" ? /AGENT_REVIEW_OUTPUT_FIELDS_INVALID/ : /AGENT_RESULT_LOCKED_IDENTITY_INVALID/);
}
process.stdout.write("[ACCEPTANCE][naming-bazi-analysis-and-naming] PASS (deterministic Product fixture only)\n");
