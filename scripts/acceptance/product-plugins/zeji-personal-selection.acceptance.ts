import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { parseZejiResult } from "../../../src/plugins/zeji-personal-selection/result-contract.js";
import { buildProductTask, exerciseProductFlow, exerciseConfirmedSubmitRecovery, FIXTURE_HASH,
  routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find(entry => entry.pluginId === "zeji-personal-selection");
assert(plugin);
const skill = readFileSync(new URL("../../../src/plugins/zeji-personal-selection/SKILL.md", import.meta.url), "utf8");
for (const route of routesForPlugin(plugin, productionRoutePolicies)) {
  const review = route.relation_kind === "review";
  const task = buildProductTask(route, { parameters: review ? route.action_id === "accuracy_challenge"
    ? { challenge_id: "challenge:zeji", question_text: "核查出处与时间条件" }
    : { reflection_plan_id: "reflection:zeji", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: [] }
    : { project_ref: "project:zeji", context_package_ref: "context:zeji", requirement_manifest_ref: "requirement:zeji",
      requirement_manifest_hash: FIXTURE_HASH, output_contract_ref: "contract:zeji" },
    reviewPolicy: route.action_id === "quality_reflection" ? "scheduled-quality-reflection.v1" : "manual-accuracy-challenge.v1" });
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version, requirement_manifest_ref: task.parameters.requirement_manifest_ref,
    requirement_manifest_hash: task.parameters.requirement_manifest_hash, decision: "recommended",
    research_markdown: " 原样保留：� e\u0301 𠮷\n完整工程正文 ", recommendations: [],
    day_coverage: [{ date: "2026-11-01", status: "researched", reason_markdown: "工程资料完整" }],
    citations: [], uncertainties: [], limitations: [], provider_extension: { nested: ["末段�", "e\u0301𠮷"] },
  };
  const materialContents = Object.fromEntries(task.material_refs.filter(material => material.media_type === "application/zip")
    .map(material => [material.role, zipSync({ "工程夹具/完整首尾.txt": strToU8("首段\n末段；仅验证完整附件运输") })]));
  const fixture = { task, output, productSkillText: skill, materialContents };
  const run = await exerciseProductFlow(plugin, fixture);
  assert.deepEqual(run.completed.payload, output);
  assert.equal(run.physicalSubmitDispatches, 1);
  assert.equal(run.generatedImageUploads, 0);
  const promptCall = run.calls.find(call => call.child === "write_exact_gpt_prompt");
  assert(promptCall?.child === "write_exact_gpt_prompt");
  assert.ok(promptCall.input.prompt.startsWith(skill));
  assert.ok(promptCall.input.prompt.includes(JSON.stringify(route.result_contract)));
  const attach = run.calls.find(call => call.child === "attach_approved_gpt_files_once");
  const submit = run.calls.find(call => call.child === "submit_exact_gpt_turn_once");
  assert(attach?.child === "attach_approved_gpt_files_once" && submit?.child === "submit_exact_gpt_turn_once");
  assert.deepEqual(attach.input.files.map(file => file.artifactRef), task.material_refs.map(file => file.material_id));
  assert.deepEqual(submit.input.files.map(file => file.artifactRef), task.material_refs.map(file => file.material_id));
  await exerciseConfirmedSubmitRecovery(plugin, fixture);
  const changedPrompt = await exerciseProductFlow(plugin, { ...fixture, confirmedSubmit: true,
    confirmedPromptHash: FIXTURE_HASH, resultRevision: { revision: 1, priorRejection: null } });
  assert.equal(changedPrompt.physicalSubmitDispatches, 0);
  assert.deepEqual(changedPrompt.calls.map(call => call.child), ["checkpoint_gpt_text_response"]);
  assert.throws(() => parseZejiResult({ ...task, product_id: "foreign" }, JSON.stringify(output), route), /OWNER_MISMATCH/u);
  assert.throws(() => parseZejiResult(task, `${JSON.stringify(output)} {"second":true}`, route), /AMBIGUOUS/u);
  if (review) {
    assert.throws(() => parseZejiResult(task, '{"decision":"recommended","issues":[]}', route), /DECISION_INVALID/u);
    assert.throws(() => parseZejiResult(task, '{"decision":"no_issue","issues":{}}', route), /ISSUES_REQUIRED/u);
    assert.deepEqual(parseZejiResult(task, JSON.stringify({ ...output, extra: { last: true } }), route),
      { ...output, extra: { last: true } });
  } else {
    for (const decision of ["recommended", "conditional", "no_suitable_candidate"]) {
      assert.equal(parseZejiResult(task, JSON.stringify({ ...output, decision }), route).decision, decision);
    }
    for (const mutation of [{ requirement_manifest_ref: "wrong" }, { requirement_manifest_hash: "wrong" },
      { schema_version: "wrong" }, { decision: "wrong" }, { research_markdown: "" }, { research_markdown: " \n\t" },
      { research_markdown: 123 }, { research_markdown: null }, { day_coverage: [] }, { recommendations: {} },
      { citations: null }, { limitations: {} }, { uncertainties: "unknown" }]) {
      assert.throws(() => parseZejiResult(task, JSON.stringify({ ...output, ...mutation }), route));
    }
    for (const field of Object.keys(output).filter(key => key !== "provider_extension")) {
      const missing = { ...output } as Record<string, unknown>; delete missing[field];
      assert.throws(() => parseZejiResult(task, JSON.stringify(missing), route));
    }
    const parts = [task.material_refs[0]!, ...[1, 2].flatMap(index => [0, 1].map(part => ({ ...task.material_refs[index]!,
      material_id: `${task.source_task_id}:${task.material_refs[index]!.role}:${part}`, display_name: `part-${index}-${part}.zip` })))];
    const multiTask = { ...task, material_refs: parts.map((material, ordinal) => ({ ...material, ordinal })) };
    const multi = await exerciseProductFlow(plugin, { ...fixture, task: multiTask });
    const allFiles = multi.calls.find(call => call.child === "attach_approved_gpt_files_once");
    assert(allFiles?.child === "attach_approved_gpt_files_once");
    assert.deepEqual(allFiles.input.files.map(file => file.artifactRef), multiTask.material_refs.map(file => file.material_id));
  }
  await assert.rejects(exerciseProductFlow(plugin, { ...fixture,
    onChildCall: call => { if (call.child === "attach_approved_gpt_files_once") throw new Error("attachment failed"); } }), /attachment failed/u);
  await assert.rejects(exerciseProductFlow(plugin, { ...fixture, checkpointOutput: () => ({ schema_version: "invalid" }) }));
}
process.stdout.write("[ACCEPTANCE][zeji-personal-selection] PASS (engineering Child stubs; no Provider research or Website admission)\n");
