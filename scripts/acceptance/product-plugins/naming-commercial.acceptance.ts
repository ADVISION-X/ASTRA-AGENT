import { readFileSync } from "node:fs";
import { gptAttachmentProviderDisplayName } from "../../../src/capabilities/gpt/index.js";
import { zipSync, strToU8 } from "fflate";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { namingCommercialPlugin } from "../../../src/plugins/naming-commercial/index.js";
import { parseProductResult } from "../../../src/plugins/naming-commercial/result-contract.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { productPluginCatalogSnapshot, assertProductRouteSupported } from "../../../src/mediator/product-plugin-catalog.js";
import { sha256, type ProductPlugin } from "../../../src/mediator/product-plugin-contract.js";
import { buildProductTask, exerciseProductFlow, exerciseConfirmedSubmitRecovery, routesForPlugin } from "../product-plugin-test-runtime.js";

const skill = readFileSync(new URL("../../../src/plugins/naming-commercial/SKILL.md", import.meta.url), "utf8");
const originalName = " e\u0301𠮷🌙 ";
const manifestHash = sha256("commercial-manifest-v3");

// The shared deterministic port deliberately returns an opaque checkpoint hash.
// Bind this Product's test response to its actual bytes; never alter production reception.
function fixturePlugin(fault: "none" | "hash" | "attachments" | "effect" = "none"): ProductPlugin {
  return { ...namingCommercialPlugin, execute: (task, context) => namingCommercialPlugin.execute(task, {
    ...context, gpt: { ...context.gpt, execute: async call => {
      const receipt = await context.gpt.execute(call);
      if (call.child === "checkpoint_gpt_text_response") {
        const value = receipt.value as Record<string, unknown>;
        return { ...receipt, value: { ...value, semanticTextHash: sha256(fault === "hash" ? "wrong" : String(value.semanticText)) } } as never;
      }
      if (fault === "attachments" && call.child === "reconcile_gpt_attachment_set") return { ...receipt, value: { files: [] } } as never;
      if (fault === "effect" && call.child === "submit_exact_gpt_turn_once") return { ...receipt, effectReceipt: null };
      return receipt;
    } },
  }) };
}

assert.equal(productPluginCatalogSnapshot.filter(route => route.product_id === "naming_commercial").length, 3);
for (const action of ["produce", "accuracy_challenge", "quality_reflection"]) {
  assert.throws(() => assertProductRouteSupported("naming_bazi_analysis_and_naming", action), /PLUGIN_ROUTE_UNSUPPORTED/u);
}
for (const route of routesForPlugin(namingCommercialPlugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const task = buildProductTask(route, review
    ? route.action_id === "accuracy_challenge"
      ? { parameters: { challenge_id: "review:commercial", question_text: originalName }, reviewPolicy: "manual-accuracy-challenge.v1" }
      : { parameters: { reflection_plan_id: "reflection:commercial", reflection_contract_version: "scheduled-quality-reflection.v1",
        evidence_ref_catalog: ["receipt:commercial"] }, reviewPolicy: "scheduled-quality-reflection.v1" }
    : { parameters: { project_ref: "commercial:project", context_package_ref: "commercial:context",
      requirement_manifest_ref: "commercial:manifest", requirement_manifest_hash: manifestHash, output_contract_ref: "naming-report-output.v3" } });
  const issue = { observation: originalName, unknown: { text: originalName } };
  const output = review ? { decision: "issues", issues: [issue], extra: originalName } : {
    schema_version: route.result_schema_version, requirement_manifest_ref: "commercial:manifest", requirement_manifest_hash: manifestHash,
    candidates: Array.from({ length: 20 }, (_, index) => ({ candidate_id: `candidate:${index}`, name_original: `${originalName}${index}`, rank: index + 1 })),
    top_comparison: [], recommendation: { primary_candidate_id: "candidate:0", alternative_candidate_ids: ["candidate:1", "candidate:2"] },
    uncertainties: [], limitations: [], safety_notes: [], unknown: { originalName },
  };
  const archive = zipSync({
    "起名资料/00_资料目录.json": strToU8(JSON.stringify({ record_pages: { research: { pages: ["起名资料/阅读/完整需求.md"] } } })),
    "起名资料/阅读/完整需求.md": strToU8(JSON.stringify({ object_kind: "brand", raw_requirement: originalName,
      manifest: { schema_version: "NamingRequirementManifestV3", delivery_commitment: { minimum_candidates: 20 } } })),
    "起名资料/08_所选典籍/原文.md": strToU8("当前获准原典正文"),
    "起名资料/08_所选典籍/索引.json": strToU8(JSON.stringify({ locator: "原文" })),
  });
  const fixture = { task, output, productSkillText: skill,
    materialContents: review ? {} : { naming_context_package: archive } };
  const plugin = fixturePlugin();
  const run = await exerciseProductFlow(plugin, fixture);
  assert.deepEqual(run.completed.payload, output);
  assert.equal(run.physicalSubmitDispatches, 1);
  const sequence = run.calls.map(call => call.child);
  assert.deepEqual(sequence, ["prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v3",
    "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3", "close_gpt_execution_profile",
    "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
    "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response"]);
  const write = run.calls.find(call => call.child === "write_exact_gpt_prompt")!;
  const submit = run.calls.find(call => call.child === "submit_exact_gpt_turn_once")!;
  assert.equal(submit.input.promptHash, sha256(write.input.prompt));
  assert.deepEqual(submit.input.files, run.calls.find(call => call.child === "attach_approved_gpt_files_once")!.input.files
    .map(file => ({ ...file, providerDisplayName: gptAttachmentProviderDisplayName(file.displayName, task.job_id, file.artifactRef) })));
  assert.ok(write.input.prompt.startsWith(skill));
  assert.ok(write.input.prompt.includes(JSON.stringify(route.result_contract)));
  const model = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  assert.equal(model.input.profile.startModelDisplayName, "最新");
  assert.equal(model.input.profile.requestedReasoningValue, 4);
  await exerciseConfirmedSubmitRecovery(plugin, fixture);
  if (review) {
    assert.deepEqual(parseProductResult(task, { ...output, issues: issue }, route), output);
    assert.throws(() => parseProductResult(task, { decision: "invalid", issues: [] }, route), /AGENT_REVIEW_DECISION_INVALID/u);
  } else {
    for (const key of ["requirement_manifest_ref", "requirement_manifest_hash"]) {
      assert.throws(() => parseProductResult(task, { ...output, [key]: "foreign" }, route), /LOCKED_IDENTITY_INVALID/u);
    }
    const received = parseProductResult(task, { ...output, uncertainties: originalName }, route);
    assert.deepEqual(received.uncertainties, [originalName]);
    assert.deepEqual(received.candidates, output.candidates);
    assert.equal(run.calls.find(call => call.child === "attach_approved_gpt_files_once")!.input.files.length, 1);
    for (const fragment of ["01_上下文", "04_需求原文与反馈", "05_需求Manifest", "08_所选典籍"]) assert.ok(write.input.prompt.includes(fragment));
  }
  assert.throws(() => parseProductResult({ ...task, product_id: "foreign" }, output, route), /OWNER_MISMATCH/u);
  for (const [fault, code] of [["hash", /PRODUCT_TEXT_CHECKPOINT_INVALID/u], ["attachments", /PRODUCT_ATTACHMENT_RECONCILIATION_INVALID/u],
    ["effect", /PRODUCT_PROVIDER_EFFECT_TERMINAL_FACT_MISSING/u]] as const) await assert.rejects(exerciseProductFlow(fixturePlugin(fault), fixture), code);
}
process.stdout.write("[ACCEPTANCE][naming-commercial] PASS (deterministic transport only)\n");
