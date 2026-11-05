import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { sha256 } from "../../../src/mediator/product-plugin-contract.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find(p => p.pluginId === "s00-paper-factory");
assert(plugin);
const commonSkill = readFileSync("src/plugins/s00-paper-factory/SKILL.md", "utf8");
const roots = readdirSync("src/plugins", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
function assertSkillConsumed(prompt: unknown, stage: string): void {
  const root = roots.find(name => name.startsWith(stage + "-"));
  assert(root);
  assert(typeof prompt === "string" && prompt.includes(commonSkill));
  assert(prompt.includes(readFileSync(`src/plugins/${root}/SKILL.md`, "utf8")));
}
const ref = (name: string) => ({ ref: `work:order:${name}`, version: "1", sha256: FIXTURE_HASH, bytes: 20 });
const workspace = { account_ref: "account:paper-test", marker: "order:paper-test", directory_ref: "work:paper-test" };
const profile = { mode: "work", model: "GPT-5.6 Sol", reasoning: "3", profile_revision: "profile:paper-test" };
const resources = { observed_profile: profile, usage_ref: null, remaining_constraint: "within current authorization", progress_refs: [] };
const languages={communication_locale:"zh-TW",manuscript_locale:"en-US"};
const briefPolicy = productionRoutePolicy("astra_paper_research", "prepare_brief");
const briefBase = buildProductTask(briefPolicy, { parameters: {
  ...languages, submission_id: "submission:paper-test", original_text: "研究指定行业问题，交付论文和完整资料包", input_version: 1, research_tier: "high",
} });
const brief = { ...briefBase, material_refs: briefBase.material_refs.filter(m => m.role !== "research_input")
  .map((m, ordinal) => ({ ...m, ordinal })) };
const briefOutput = { schema_version: "astra-research-brief.v1", submission_id: "submission:paper-test", project_id: "project:paper-test",
  input_version: 1, tier: "high", disposition: "feasible", outline: ["问题、方法、证据及论证"], scope: "冻结研究范围", method: "适合问题的方法",
  materials: [], premises: [], preserve_boundaries: "", limitations: [], missing_items: [], executable_scope: "现有要求可规划" };
const first = await exerciseProductFlow(plugin, { task: brief, output: briefOutput, productSkillText: commonSkill });
assert.deepEqual(first.completed.payload, briefOutput);
assert.equal(first.calls[0]?.child, "prepare_clean_gpt_work");
assert.equal(first.calls.filter(c => c.child === "submit_exact_gpt_turn_once").length, 1);
const firstPrompt = first.calls.find(c => c.child === "write_exact_gpt_prompt")!;
assertSkillConsumed(firstPrompt.input.prompt, "s01");
assert(String(firstPrompt.input.prompt).includes('"communication_locale":"zh-TW"'));
await assert.rejects(exerciseProductFlow(plugin, {task:{...brief,parameters:{...brief.parameters,manuscript_locale:null}},
  output:briefOutput}),/FACTORY_INPUT_LANGUAGE_INVALID/u);
await assert.rejects(exerciseProductFlow(plugin, { task: brief, output: { ...briefOutput, submission_id: "foreign" } }));
await assert.rejects(exerciseProductFlow(plugin, { task: brief, output: { ...briefOutput, tier: "max" } }));
const needs = { ...briefOutput, disposition: "needs_input", missing_items: ["明确研究对象和期间"] };
const dialogue = await exerciseProductFlow(plugin, { task: brief, output: needs, expectedSessionCount: 2,
  checkpointOutput: call => call.sessionKey === "c01"
    ? { schema_version: "astra-c01-output.v1", missing_items: ["请说明研究对象及覆盖期间"] } : needs });
assert.deepEqual(dialogue.calls.filter(c => c.child === "prepare_clean_gpt_chat").map(c => c.sessionKey), ["c01"]);
assert.deepEqual((dialogue.completed.payload as Record<string, unknown>).missing_items, ["请说明研究对象及覆盖期间"]);

const dialogueRoute = productionRoutePolicy("astra_paper_research", "user_dialogue");
const turnId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const dialogueContext = Buffer.from(JSON.stringify({ input_version: 0, order: null, project_id: projectId, communication_locale:languages.communication_locale,title: "校验项目" }));
const dialogueIdentity = { turn_id: turnId, project_id: projectId, dialogue_input_version: 0,
  dialogue_order_revision: null, dialogue_context_hash: sha256(dialogueContext) };
const question = "这个项目已经确认交付期限了吗？";
const dialogueBase = buildProductTask(dialogueRoute, { parameters: { ...dialogueIdentity, question, communication_locale:languages.communication_locale } });
const dialogueTask = { ...dialogueBase, material_refs: dialogueBase.material_refs.map(material => material.role === "dialogue_context" ? ({
  ...material, object_ref: `context:astra-dialogue:${turnId}`, sha256: sha256(dialogueContext), bytes: dialogueContext.byteLength,
}) : material) };
const dialogueAnswer = { schema_version: "astra-user-dialogue.v1", ...dialogueIdentity,
  disposition: "answer", answer: "目前没有已确认的交付期限。", requirements: [] };
const dialogueFixture = { task: dialogueTask, output: dialogueAnswer, materialContents: { dialogue_context: dialogueContext },
  productSkillText: commonSkill, workAccess: async () => { throw new Error("C01_MUST_NOT_READ_WORK"); } };
const customerDialogue = await exerciseProductFlow(plugin, dialogueFixture);
assert.deepEqual(customerDialogue.completed.payload, dialogueAnswer);
assert.equal(customerDialogue.physicalSubmitDispatches, 1);
assert.deepEqual(customerDialogue.calls.filter(c => c.child.startsWith("prepare_clean_gpt")).map(c => c.child), ["prepare_clean_gpt_chat"]);
const customerPrompt = customerDialogue.calls.find(c => c.child === "write_exact_gpt_prompt")!.input.prompt;
assertSkillConsumed(customerPrompt, "c01");
assert(String(customerPrompt).includes(question) && !String(customerPrompt).includes(dialogueTask.business_identity.authorization_ref));
await assert.rejects(exerciseProductFlow(plugin, { ...dialogueFixture,
  output: { ...dialogueAnswer, dialogue_context_hash: FIXTURE_HASH_B } }), /AGENT_RESULT_LOCKED_IDENTITY_INVALID:dialogue_context_hash/u);
await assert.rejects(exerciseProductFlow(plugin, { ...dialogueFixture,
  task: { ...dialogueTask, parameters: { ...dialogueTask.parameters, dialogue_context_hash: FIXTURE_HASH_B } } }),
  /C01_CONTEXT_IDENTITY_INVALID/u);
const recovered = await exerciseProductFlow(plugin, { task: briefBase, output: briefOutput, confirmedSubmit: true,
  confirmedPromptHash: FIXTURE_HASH_B, workAccess: async () => { throw new Error("RECOVERY_MUST_NOT_REQUEST_NEW_MATERIAL_ACCESS"); } });
assert.equal(recovered.physicalSubmitDispatches, 0);
assert.deepEqual(recovered.calls.map(call => call.child), ["get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response"]);

function taskFor(action: string, maintenancePurpose = "inspect") {
  const route = productionRoutePolicy("astra_paper_research", action);
  return buildProductTask(route, { parameters: { ...languages,handoff_id: "00000000-0000-4000-8000-000000000001",
    order_id: "00000000-0000-4000-8000-000000000002", project_id: "00000000-0000-4000-8000-000000000003",
    confirmation_version: 1, confirmation_hash: FIXTURE_HASH, authorization_id: "00000000-0000-4000-8000-000000000004",
    input_version: 1, tier: "high", expected_revision: 1, parent_result_hash: FIXTURE_HASH_B,
    purpose: action === "maintain_workspace" ? maintenancePurpose : "standard" } });
}
function stageOutput(stage: string, decision = "continue") {
  let body: Record<string, unknown> = {};
  switch (stage) {
    case "s02": body = { plan_ref: ref("plan") }; break;
    case "s04":
    case "s05": body = { evidence_ref: ref("evidence") }; break;
    case "s06": body = { verification_ref: ref("verification") }; break;
    case "s07": body = { manuscript_ref: ref("manuscript") }; break;
    case "s08": body = { review_ref: ref("review") }; break;
    case "s09": body = { originality_ref: ref("originality") }; break;
  }
  return { schema_version: `astra-${stage}-output.v1`, workspace, decision, issues: [], unresolved: [], outputs: [], resources,
    coverage: [{ responsibility: stage.toUpperCase(), input_refs: [ref(stage === "s06" ? "evidence" : "manuscript")],
      read_scope: "test contract fixture", limitations: "No real Work execution is claimed by this fixture",
      check_ref: stage === "s06" ? ref("verification") : stage === "s08" ? ref("review") : stage === "s09" ? ref("originality") : ref(stage),
      context_ref: ref(`context:${stage}`) }], body };
}
const materials = { execution_policy: { profile }, project_context: { workspace,...languages }, research_context: { public_sources: [] } };
for (const [action, order] of [["build_evidence", ["s02", "s03", "s04", "s05", "s06"]],
  ["compose_manuscript", ["s07", "s08", "s09"]]] as const) {
  const task = taskFor(action);
  const run = await exerciseProductFlow(plugin, { task, output: {}, materialContents: materials, expectedSessionCount: order.length,
    productSkillText: commonSkill, checkpointOutput: call => stageOutput(call.sessionKey) });
  assert.deepEqual(run.calls.filter(c => c.child === "prepare_clean_gpt_work").map(c => c.sessionKey), order);
  const payload = run.completed.payload as Record<string, unknown>;
  assert.deepEqual(payload.execution, { attempt_id: "attempt-1", execution_fence_hash: FIXTURE_HASH });
  assert.equal(payload.action, action);
  assert.equal(payload.next_business_action, action === "build_evidence" ? "compose_manuscript" : "prepare_delivery");
  assert.deepEqual(payload.public_updates, []);
  for (const call of run.calls.filter(c => c.child === "write_exact_gpt_prompt")) {
    assertSkillConsumed(call.input.prompt, call.sessionKey);
  }

}
const stopped = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  expectedSessionCount: 2, checkpointOutput: call => call.sessionKey === "s03"
    ? { ...stageOutput("s03", "blocked"), coverage: [] } : stageOutput(call.sessionKey) });
assert.deepEqual(stopped.calls.filter(c => c.child === "submit_exact_gpt_turn_once").map(c => c.sessionKey), ["s02", "s03"]);
const stoppedPayload = stopped.completed.payload as { decision: string; coverage: { responsibility: string; read_scope: string }[] };
assert.equal(stoppedPayload.decision, "blocked");
assert.equal(Reflect.get(stoppedPayload, "next_business_action"), null);
assert.equal(stoppedPayload.coverage.find(item => item.responsibility === "S03")?.read_scope, "not reported");
assert.equal(stoppedPayload.coverage.find(item => item.responsibility === "S04")?.read_scope, "not executed");
// Transport and production routing only: the isolated provider substitutes an S08 finding.
const wrongLanguage={id:"manuscript-language",kind:"manuscript",object_ref:ref("manuscript").ref,object_version:"1",
  impact:"critical",reason:"Fixture: the abstract does not use the confirmed English writing language.",target:"S07"};
const languageBlocked=await exerciseProductFlow(plugin,{task:taskFor("compose_manuscript"),output:{},
  materialContents:materials,expectedSessionCount:2,productSkillText:commonSkill,
  checkpointOutput:call=>call.sessionKey==="s08"
    ?{...stageOutput("s08","blocked"),issues:[wrongLanguage],unresolved:[wrongLanguage.id]}:stageOutput(call.sessionKey)});
const blocked=languageBlocked.completed.payload as Record<string,unknown>;
assert.equal(blocked.decision,"blocked");
assert.equal(blocked.next_business_action,null);
assert.deepEqual(blocked.unresolved,[wrongLanguage.id]);
assert.deepEqual(languageBlocked.calls.filter(c=>c.child==="submit_exact_gpt_turn_once").map(c=>c.sessionKey),["s07","s08"]);
await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  checkpointOutput: call => call.sessionKey === "s03" ? { ...stageOutput("s03"), coverage: [] } : stageOutput(call.sessionKey) }),
/FACTORY_RESPONSIBILITY_COVERAGE_MISSING/u);
for (const mutation of ["same-context", "wrong-input", "wrong-check", "old-s09-draft", "old-s09-check"] as const) {
  await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("compose_manuscript"), output: {}, materialContents: materials,
    checkpointOutput: call => {
      const output = stageOutput(call.sessionKey);
      const s09 = mutation.startsWith("old-s09");
      if (call.sessionKey === (s09 ? "s09" : "s08")) output.coverage = output.coverage.map(item => ({ ...item,
        ...(mutation === "same-context" ? { context_ref: { ...ref("context:s07"), version: "2", sha256: FIXTURE_HASH_B } }
          : mutation === "old-s09-draft" ? { input_refs: [{ ...ref("manuscript"), version: "0" }] }
          : mutation === "old-s09-check" ? { check_ref: { ...ref("originality"), version: "0" } }
          : mutation === "wrong-input" ? { input_refs: [ref("foreign-manuscript")] } : { check_ref: ref("foreign-review") }) }));
      return output;
    } }), /FACTORY_REVIEW_HANDOFF_IDENTITY_INVALID/u);
}
await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("compose_manuscript"), output: {}, materialContents: materials,
  checkpointOutput: call => call.sessionKey === "s09" ? { ...stageOutput("s09"), unresolved: ["citation:1"],
    issues: [{ id: "citation:1", kind: "citation", object_ref: "work:manuscript", object_version: "1", impact: "critical",
      reason: "fixture: unresolved source attribution", target: "S07" }] } : stageOutput(call.sessionKey) }),
  /FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES/u);

const openIssue = { id: "finding:1", kind: "evidence", object_ref: "work:original-evidence", object_version: "1",
  impact: "critical", reason: "fixture: original observation does not support the estimate", target: "S05" };
const previous = { action: "prepare_delivery", decision: "rework", issues: [openIssue], unresolved: [openIssue.id] };
const authorized = { ...materials, execution_policy: { profile, authorized_action: "build_evidence" },
  research_context: { public_sources: [], previous_result: previous } };
const closure = { issue_id: openIssue.id, object_ref: openIssue.object_ref, object_version: openIssue.object_version,
  repaired_ref: ref("evidence"), check_ref: ref("verification") };
const repaired = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: authorized,
  expectedSessionCount: 5, checkpointOutput: call => call.sessionKey === "s06"
    ? { ...stageOutput("s06"), resolved_issues: [closure] } : stageOutput(call.sessionKey) });
const repairedPayload = repaired.completed.payload as Record<string, unknown>;
assert.deepEqual(repairedPayload.issues, [openIssue]);
assert.deepEqual(repairedPayload.unresolved, []);
assert(!Object.hasOwn(repairedPayload, "resolved_issues"));
const verificationPrompt = repaired.calls.filter(c => c.child === "write_exact_gpt_prompt").find(c => c.sessionKey === "s06")!;
assert(String(verificationPrompt.input.prompt).includes(`"pending_issues":[${JSON.stringify(openIssue)}]`));

const advisory = { ...openIssue, id: "advisory:1", impact: "noncritical" };
const carried = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  expectedSessionCount: 5, checkpointOutput: call => call.sessionKey === "s02"
    ? { ...stageOutput("s02"), issues: [advisory] } : stageOutput(call.sessionKey) });
assert.deepEqual((carried.completed.payload as Record<string, unknown>).unresolved, [advisory.id]);

const retained = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: authorized,
  expectedSessionCount: 5, confirmedSubmit: true, confirmedPromptHash: FIXTURE_HASH_B,
  workAccess: async () => { throw new Error("CONFIRMED_REVIEW_MUST_NOT_READ_NEW_MATERIAL"); },
  checkpointOutput: call => stageOutput(call.sessionKey, call.sessionKey === "s06" ? "rework" : "continue") });
assert.equal(retained.physicalSubmitDispatches, 0);
assert.equal(retained.confirmedSubmitReads.length, 5);
assert(retained.calls.every(c => ["get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response"].includes(c.child)));
assert.deepEqual((retained.completed.payload as Record<string, unknown>).unresolved, [openIssue.id]);

for (const resolved_issues of [
  [{ ...closure, issue_id: "foreign" }], [{ ...closure, object_ref: "work:foreign" }],
  [{ ...closure, object_version: "2" }], [closure, closure],
  [{ ...closure, repaired_ref: ref("unread") }], [{ ...closure, check_ref: ref("old-verification") }],
]) {
  await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: authorized,
    checkpointOutput: call => call.sessionKey === "s06" ? { ...stageOutput("s06"), resolved_issues } : stageOutput(call.sessionKey) }),
  /FACTORY_ISSUE_CLOSURE_IDENTITY_INVALID/u);
}
for (const issue of [{ ...openIssue, impact: "noncritical" }, { ...openIssue, target: "S07" }]) {
  await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: authorized,
    checkpointOutput: call => ({ ...stageOutput(call.sessionKey), issues: [issue], unresolved: [issue.id] }) }),
  /FACTORY_ISSUE_IDENTITY_CONFLICT/u);
}
for (const source of [authorized, { ...authorized, execution_policy: { profile, authorized_action: "compose_manuscript" } }]) {
  const submittedStages: string[] = [];
  await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: source,
    onChildCall: call => { if (call.child === "checkpoint_gpt_text_response") submittedStages.push(call.sessionKey); },
    checkpointOutput: call => stageOutput(call.sessionKey) }), /FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES/u);
  assert.deepEqual(submittedStages, source === authorized ? ["s02", "s03", "s04", "s05", "s06"] : ["s02"]);
}
const newCritical = { ...openIssue, id: "finding:2", object_ref: "work:new-evidence" };
await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: authorized,
  checkpointOutput: call => ({ ...stageOutput(call.sessionKey), issues: [newCritical] }) }),
/FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES/u);
const newStop = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: authorized,
  checkpointOutput: call => ({ ...stageOutput(call.sessionKey, "supplement"), issues: [newCritical], unresolved: [newCritical.id] }) });
assert.deepEqual((newStop.completed.payload as Record<string, unknown>).unresolved, [openIssue.id, newCritical.id]);
assert.equal((newStop.completed.payload as Record<string, unknown>).decision, "supplement");
assert.equal((newStop.completed.payload as Record<string, unknown>).next_business_action, "build_evidence");

const manuscriptIssue = { ...openIssue, kind: "manuscript", target: "S07" };
const citationIssue = { ...openIssue, id: "citation:2", kind: "citation", target: "S07" };
const manuscriptMaterials = { ...materials, execution_policy: { profile, authorized_action: "compose_manuscript" },
  research_context: { public_sources: [], previous_result: { ...previous, action: "compose_manuscript",
    issues: [manuscriptIssue, citationIssue], unresolved: [manuscriptIssue.id, citationIssue.id] } } };
function repairedDraft(stage: string, omission?: "transfer" | "closure") {
  const output = stageOutput(stage);
  if (stage === "s07") return output;
  const check_ref = ref(stage === "s08" ? "review" : "originality");
  const issue_id = stage === "s08" ? manuscriptIssue.id : citationIssue.id;
  return { ...output, resolved_issues: stage === "s09" && omission === "closure" ? [] :
    [{ ...closure, issue_id, repaired_ref: ref("manuscript"), check_ref }],
    issues: stage === "s08" && omission !== "transfer" ? [citationIssue] : [],
    unresolved: stage === "s08" && omission !== "transfer" ? [citationIssue.id] : [],
    body: { ...output.body, manuscript_ref: ref("old-manuscript") } };
}
const revised = await exerciseProductFlow(plugin, { task: taskFor("compose_manuscript"), output: {}, expectedSessionCount: 3,
  materialContents: manuscriptMaterials, checkpointOutput: call => repairedDraft(call.sessionKey) });
const revisedPayload = revised.completed.payload as Record<string, unknown>;
assert.deepEqual(revisedPayload.issues, [manuscriptIssue, citationIssue]);
assert.deepEqual(revisedPayload.unresolved, []);
assert.deepEqual(revisedPayload.body, { manuscript_ref: ref("manuscript"), review_ref: ref("review"), originality_ref: ref("originality") });
const originalityPrompt = revised.calls.filter(c => c.child === "write_exact_gpt_prompt").find(c => c.sessionKey === "s09")!;
assert(String(originalityPrompt.input.prompt).includes(`"pending_issues":[${JSON.stringify(citationIssue)}]`));
for (const omission of ["transfer", "closure"] as const) {
  const checked: string[] = [];
  await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("compose_manuscript"), output: {}, materialContents: manuscriptMaterials,
    checkpointOutput: call => { checked.push(call.sessionKey); return repairedDraft(call.sessionKey, omission); } }),
  /FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES/u);
  assert.deepEqual(checked, omission === "transfer" ? ["s07", "s08"] : ["s07", "s08", "s09"]);
}
await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  checkpointOutput: call => ({ ...stageOutput(call.sessionKey), resolved_issues: [] }) }), /S02_RESULT_FIELDS_INVALID/u);

const imageBlocked = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  expectedSessionCount: 3, checkpointOutput: call => stageOutput(call.sessionKey, call.sessionKey === "s04" ? "blocked" : "continue") });
assert.deepEqual(imageBlocked.calls.filter(c => c.child === "submit_exact_gpt_turn_once").map(c => c.sessionKey), ["s02", "s03", "s04"]);
for (const [action, purpose, next] of [["prepare_workspace", "standard", "build_evidence"], ["maintain_workspace", "inspect", null],
  ["maintain_workspace", "repair_files", "prepare_delivery"], ["prepare_delivery", "standard", "archive_delivery"],
  ["archive_delivery", "standard", null]] as const) {
  const task = taskFor(action, purpose), stage = action.includes("delivery") ? "s10" : "workspace";
  const body = action === "prepare_workspace" ? { transfers: [], requirements_ref: ref("requirements") }
    : action === "maintain_workspace" ? { purpose, original_delivery_ref: ref("original-delivery"), objects: [], report_ref: ref("maintenance") }
      : action === "prepare_delivery" ? { manuscript_ref: ref("manuscript"), package_version: "1", files: [], package_check_ref: ref("package-check") }
        : { preflight_result_hash: FIXTURE_HASH_B, package_version: "1", files: [], script_report_ref: ref("script-report") };
  const contract = productionRoutePolicy("astra_paper_research", action).result_contract!;
  const output = { ...stageOutput(stage), body, coverage: (contract.required_responsibilities as string[]).map(responsibility => ({
    responsibility, input_refs: [ref("authorized-input")], read_scope: "fixture only", limitations: "No real file action claimed",
    check_ref: ref("check"), context_ref: ref(stage) })) };
  const run = await exerciseProductFlow(plugin, { task, output, productSkillText: commonSkill,
    materialContents: { ...authorized, delivery_plan: { files: [] } } });
  assert.equal((run.completed.payload as Record<string, unknown>).action, action);
  assert.equal(run.calls.filter(c => c.child === "submit_exact_gpt_turn_once").length, 1);
  assert.deepEqual((run.completed.payload as Record<string, unknown>).body, body);
  assert.deepEqual((run.completed.payload as Record<string, unknown>).unresolved, []);
  assert.equal((run.completed.payload as Record<string, unknown>).next_business_action, next);
  assert.deepEqual((run.completed.payload as Record<string, unknown>).public_updates, []);
  if (action === "prepare_delivery") {
    const issue = { ...openIssue, kind: "assembly", target: "assembly" };
    const repair = await exerciseProductFlow(plugin, { task, materialContents: { ...authorized, delivery_plan: { files: [] } },
      output: { ...output, decision: "rework", issues: [issue], unresolved: [issue.id] } });
    assert.deepEqual(repair.completed.payload, { ...run.completed.payload as object,
      decision: "blocked", next_business_action: null, issues: [issue], unresolved: [issue.id] });
  }
  if (stage === "s10") {
    const prompt = run.calls.find(c => c.child === "write_exact_gpt_prompt")!.input.prompt;
    assertSkillConsumed(prompt, "s10");
    assert(String(prompt).includes(readFileSync("src/plugins/s10-research-package/delivery-script.py", "utf8")));
  }
}
assert.deepEqual(productionPluginCatalog.flatMap(p => p.accepts).filter(r => r.productId === "astra_paper_research")
  .map(r => r.actionId).sort(), plugin.accepts.map(r => r.actionId).sort());
assert(roots.includes("payment-screenshot-observation"));
assert(!roots.some(name => name.startsWith("bazi-") || name.startsWith("qimen-") || name === "astra-research-project"));
execFileSync("python3", ["-B", "-c", String.raw`
import datetime, hashlib, io, pathlib, runpy, sys, tempfile, urllib.error, urllib.request, zipfile
module = runpy.run_path(sys.argv[1])
with tempfile.TemporaryDirectory(prefix="astra-archive-test-") as directory:
    root = pathlib.Path(directory).resolve()
    data = b"actual research asset"
    (root / "asset.bin").write_bytes(data)
    grant = {"asset_id": "00000000-0000-4000-8000-000000000005", "object_key": "order/asset",
             "bytes": len(data), "sha256": "sha256:" + hashlib.sha256(data).hexdigest(),
             "get_url": "https://storage.invalid/original", "put_url": "https://storage.invalid/original",
             "expires_at": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)).isoformat(),
             "required_put_headers": {"If-None-Match": "*"}}
    item = {"path": "asset.bin", "purpose": "public_source", "grant": grant}
    calls, responses = [], []
    def response(request, timeout):
        calls.append(request.method)
        value = responses.pop(0)
        if isinstance(value, Exception):
            raise value
        return io.BytesIO(value)
    urllib.request.urlopen = response
    def error(code):
        return urllib.error.HTTPError(grant["get_url"], code, "fixture", {}, None)
    def transfer(sequence, expected_calls, upload, readback):
        calls.clear()
        responses[:] = sequence
        result = module["transfer"](item, root)
        assert calls == expected_calls, calls
        assert result["upload_state"] == upload, result
        assert result["readback_state"] == readback, result
        assert not responses
    transfer([data], ["GET"], "unknown", "verified")
    transfer([b"foreign"], ["GET"], "unknown", "mismatch")
    transfer([OSError("unknown")], ["GET"], "not_started", "unknown")
    transfer([error(404), b"", data], ["GET", "PUT", "GET"], "confirmed", "verified")
    transfer([error(404), error(412), data], ["GET", "PUT", "GET"], "unknown", "verified")
    transfer([error(404), error(500), data], ["GET", "PUT", "GET"], "unknown", "verified")
    transfer([error(404), error(403), error(404)], ["GET", "PUT", "GET"], "rejected", "unknown")
    for changed in [{"bytes": len(data) + 1}, {"required_put_headers": {}}, {"expires_at": "2000-01-01T00:00:00+00:00"}]:
        calls.clear()
        responses[:] = [error(404)]
        try:
            module["transfer"]({**item, "grant": {**grant, **changed}}, root)
            raise AssertionError("invalid authorization accepted")
        except ValueError:
            assert "PUT" not in calls
    try:
        module["transfer"]({**item, "path": "../outside"}, root)
        raise AssertionError("outside path accepted")
    except (ValueError, FileNotFoundError):
        pass
    for name, members, valid in [("good.docx", {"[Content_Types].xml": "<Types/>", "word/document.xml": "<document/>"}, True),
                                  ("bad.docx", {"body.txt": "not docx"}, False),
                                  ("traversal.zip", {"../escape": "unsafe"}, False)]:
        path = root / name
        with zipfile.ZipFile(path, "w") as archive:
            for member, value in members.items():
                archive.writestr(member, value)
        try:
            module["verify_container"](path, "delivery_zip" if name.endswith("zip") else "delivery_docx")
            assert valid, name
        except (ValueError, KeyError):
            assert not valid, name
`, "src/plugins/s10-research-package/delivery-script.py"], { stdio: "pipe", timeout: 10_000 });
process.stdout.write("[ACCEPTANCE][s00-paper-factory] fixed execution and result contracts\n");
