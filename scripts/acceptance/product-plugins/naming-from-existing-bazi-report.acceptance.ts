import { readFileSync } from "node:fs";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { sha256, type ProductPlugin, type ProductionRoutePolicy } from "../../../src/mediator/product-plugin-contract.js";
import { buildProductTask, exerciseProductFlow, exerciseConfirmedSubmitRecovery, routesForPlugin } from "../product-plugin-test-runtime.js";

const original = productionPluginCatalog.find(row => row.pluginId === "naming-from-existing-bazi-report");
assert(original);
const skill = readFileSync(new URL("../../../src/plugins/naming-from-existing-bazi-report/SKILL.md", import.meta.url), "utf8");
const raw = "  已交付报告与完整反馈,\ne\u0301𠮷🌙  ";
const requirementHash = sha256(raw), pair = { professional_markdown: raw, reader_explanation_markdown: raw };
const sequence = ["prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3", "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response"];

// Bind this Product's mocked checkpoint to its actual semantic bytes, without changing the shared test port.
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
    project_ref: "project-a", context_package_ref: "context-a", requirement_manifest_ref: "requirement-a",
    requirement_manifest_hash: requirementHash, output_contract_ref: "naming-report-output.v2"
  } });
  return buildProductTask(route, route.action_id === "accuracy_challenge"
    ? { parameters: { challenge_id: "challenge-a", question_text: raw }, reviewPolicy: "manual-accuracy-challenge.v1" }
    : { parameters: { reflection_plan_id: "reflection-a", reflection_contract_version: "scheduled-quality-reflection.v1",
      evidence_ref_catalog: ["receipt-a"] }, reviewPolicy: "scheduled-quality-reflection.v1" });
}
function body(route: ProductionRoutePolicy): Readonly<Record<string, unknown>> {
  if (route.relation_kind === "review") return { decision: "no_issue", issues: [] };
  return { schema_version: route.result_schema_version, requirement_manifest_ref: "requirement-a", requirement_manifest_hash: requirementHash,
    naming_rationale: pair, comparison_or_selection_rationale: pair, candidates: [{ name: "e\u0301𠮷🌙", explanation: pair }],
    covered_requirement_anchor_refs: ["requirement-a:raw"], uncertainties: [], limitations: [], safety_notes: [] };
}
for (const route of routesForPlugin(original, productionRoutePolicies)) {
  const task = taskFor(route), output = body(route);
  const materialContents = Object.fromEntries(route.material_roles.map(row => [row.role, {
    role: row.role, raw_user_input: raw, feedback_history: [{ feedback_text: raw }],
    requirement_manifest: { schema_version: "NamingRequirementManifestV2", required_items: [raw] },
    source_relation: { source_report_ref: "report-a", source_report_hash: sha256("report-a") }
  }]));
  const fixture = { task, output, materialContents, productSkillText: skill };
  await assert.rejects(exerciseProductFlow(original, fixture), /PRODUCT_TEXT_CHECKPOINT_INVALID/);
  const plugin = checkpointFixture(), run = await exerciseProductFlow(plugin, fixture);
  assert.deepEqual(run.calls.map(call => call.child), sequence);
  assert.deepEqual(run.completed.payload, output);
  assert.equal(run.physicalSubmitDispatches, 1);
  assert.equal(run.generatedImageUploads, 0);
  const attached = run.calls.find(call => call.child === "attach_approved_gpt_files_once")!;
  assert.deepEqual(attached.input.files.map(file => [file.sha256, file.bytes]), route.material_roles.map(row => {
    const bytes = JSON.stringify(materialContents[row.role]); return [sha256(bytes), Buffer.byteLength(bytes)];
  }));
  const written = run.calls.find(call => call.child === "write_exact_gpt_prompt")!;
  const submitted = run.calls.find(call => call.child === "submit_exact_gpt_turn_once")!;
  assert.equal(submitted.input.promptHash, sha256(written.input.prompt));
  assert.ok(written.input.prompt.startsWith(skill));
  assert.ok(written.input.prompt.includes(JSON.stringify(task.parameters)));
  assert.equal(new Set(run.calls.map(call => call.sessionKey)).size, 1);
  await exerciseConfirmedSubmitRecovery(plugin, fixture);
  for (const [fault, code] of [["hash", /PRODUCT_TEXT_CHECKPOINT_INVALID/], ["files", /PRODUCT_ATTACHMENT_RECONCILIATION_INVALID/],
    ["effect", /PRODUCT_PROVIDER_EFFECT_TERMINAL_FACT_MISSING/]] as const) await assert.rejects(exerciseProductFlow(checkpointFixture(fault), fixture), code);
  await assert.rejects(exerciseProductFlow(plugin, { ...fixture, output: route.relation_kind === "review"
    ? { decision: "no_issue", issues: [], candidates: [raw] }
    : { ...output, requirement_manifest_hash: sha256("wrong-manifest") } }),
    route.relation_kind === "review" ? /AGENT_REVIEW_OUTPUT_FIELDS_INVALID/ : /AGENT_RESULT_LOCKED_IDENTITY_INVALID/);
}
process.stdout.write("[ACCEPTANCE][naming-from-existing-bazi-report] PASS (deterministic Product fixture only)\n");
