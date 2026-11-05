import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, FIXTURE_HASH, FIXTURE_HASH_B } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find(p => p.pluginId === "s00-paper-factory");
assert(plugin);
const commonSkill = readFileSync("src/plugins/s00-paper-factory/SKILL.md", "utf8");
const ref = (name: string) => ({ ref: `work:order:${name}`, version: "1", sha256: FIXTURE_HASH, bytes: 20 });
const workspace = { account_ref: "account:paper-test", marker: "order:paper-test", directory_ref: "work:paper-test" };
const profile = { mode: "work", model: "GPT-5.6 Sol", reasoning: "3", profile_revision: "profile:paper-test" };
const resources = { observed_profile: profile, usage_ref: null, remaining_constraint: "within current authorization", progress_refs: [] };
const briefPolicy = productionRoutePolicy("astra_paper_research", "prepare_brief");
const briefBase = buildProductTask(briefPolicy, { parameters: {
  submission_id: "submission:paper-test", original_text: "研究指定行业问题，交付论文和完整资料包", input_version: 1, research_tier: "high",
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
assert(String(firstPrompt.input.prompt).includes(readFileSync("src/plugins/s01-research-brief/SKILL.md", "utf8")));
await assert.rejects(exerciseProductFlow(plugin, { task: brief, output: { ...briefOutput, submission_id: "foreign" } }));
await assert.rejects(exerciseProductFlow(plugin, { task: brief, output: { ...briefOutput, tier: "max" } }));
const needs = { ...briefOutput, disposition: "needs_input", missing_items: ["明确研究对象和期间"] };
const dialogue = await exerciseProductFlow(plugin, { task: brief, output: needs, expectedSessionCount: 2,
  checkpointOutput: call => call.sessionKey === "c01"
    ? { schema_version: "astra-c01-output.v1", missing_items: ["请说明研究对象及覆盖期间"] } : needs });
assert.deepEqual(dialogue.calls.filter(c => c.child === "prepare_clean_gpt_chat").map(c => c.sessionKey), ["c01"]);
const recovered = await exerciseProductFlow(plugin, { task: briefBase, output: briefOutput, confirmedSubmit: true,
  confirmedPromptHash: FIXTURE_HASH_B, workAccess: async () => { throw new Error("RECOVERY_MUST_NOT_REQUEST_NEW_MATERIAL_ACCESS"); } });
assert.equal(recovered.physicalSubmitDispatches, 0);
assert.deepEqual(recovered.calls.map(call => call.child), ["get_submitted_gpt_conversation_url", "checkpoint_gpt_text_response"]);

function taskFor(action: string) {
  const route = productionRoutePolicy("astra_paper_research", action);
  return buildProductTask(route, { parameters: { handoff_id: "00000000-0000-4000-8000-000000000001",
    order_id: "00000000-0000-4000-8000-000000000002", project_id: "00000000-0000-4000-8000-000000000003",
    confirmation_version: 1, confirmation_hash: FIXTURE_HASH, authorization_id: "00000000-0000-4000-8000-000000000004",
    input_version: 1, tier: "high", expected_revision: 1, parent_result_hash: FIXTURE_HASH_B,
    purpose: action === "maintain_workspace" ? "inspect" : "standard" } });
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
      check_ref: stage === "s06" ? ref("verification") : stage === "s08" ? ref("review") : ref(stage), context_ref: ref(`context:${stage}`) }], body };
}
const materials = { execution_policy: { profile }, project_context: { workspace }, research_context: { public_sources: [] } };
for (const [action, order] of [["build_evidence", ["s02", "s03", "s04", "s05", "s06"]],
  ["compose_manuscript", ["s07", "s08", "s09"]]] as const) {
  const task = taskFor(action);
  const run = await exerciseProductFlow(plugin, { task, output: {}, materialContents: materials, expectedSessionCount: order.length,
    productSkillText: commonSkill, checkpointOutput: call => stageOutput(call.sessionKey) });
  assert.deepEqual(run.calls.filter(c => c.child === "prepare_clean_gpt_work").map(c => c.sessionKey), order);
  const payload = run.completed.payload as Record<string, unknown>;
  assert.deepEqual(payload.execution, { attempt_id: "attempt-1", execution_fence_hash: FIXTURE_HASH });
  assert.equal(payload.action, action);
  for (const call of run.calls.filter(c => c.child === "write_exact_gpt_prompt")) {
    assert(String(call.input.prompt).includes(`# ${call.sessionKey.toUpperCase()}`));
  }
}
const stopped = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  expectedSessionCount: 2, checkpointOutput: call => stageOutput(call.sessionKey, call.sessionKey === "s03" ? "blocked" : "continue") });
assert.deepEqual(stopped.calls.filter(c => c.child === "submit_exact_gpt_turn_once").map(c => c.sessionKey), ["s02", "s03"]);
assert.equal((stopped.completed.payload as Record<string, unknown>).decision, "blocked");
for (const mutation of ["same-context", "wrong-input", "wrong-check"] as const) {
  await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("compose_manuscript"), output: {}, materialContents: materials,
    checkpointOutput: call => {
      const output = stageOutput(call.sessionKey);
      if (call.sessionKey === "s08") output.coverage = output.coverage.map(item => ({ ...item,
        ...(mutation === "same-context" ? { context_ref: ref("context:s07") }
          : mutation === "wrong-input" ? { input_refs: [ref("foreign-manuscript")] } : { check_ref: ref("foreign-review") }) }));
      return output;
    } }), /FACTORY_REVIEW_HANDOFF_IDENTITY_INVALID/u);
}
await assert.rejects(exerciseProductFlow(plugin, { task: taskFor("compose_manuscript"), output: {}, materialContents: materials,
  checkpointOutput: call => call.sessionKey === "s09" ? { ...stageOutput("s09"), unresolved: ["citation:1"],
    issues: [{ id: "citation:1", kind: "citation", object_ref: "work:manuscript", object_version: "1", impact: "critical",
      reason: "fixture: unresolved source attribution", target: "S07" }] } : stageOutput(call.sessionKey) }),
  /FACTORY_CONTINUE_CONTRADICTS_DECLARED_ISSUES/u);
const imageBlocked = await exerciseProductFlow(plugin, { task: taskFor("build_evidence"), output: {}, materialContents: materials,
  expectedSessionCount: 3, checkpointOutput: call => stageOutput(call.sessionKey, call.sessionKey === "s04" ? "blocked" : "continue") });
assert.deepEqual(imageBlocked.calls.filter(c => c.child === "submit_exact_gpt_turn_once").map(c => c.sessionKey), ["s02", "s03", "s04"]);
for (const action of ["prepare_workspace", "maintain_workspace", "prepare_delivery", "archive_delivery"]) {
  const task = taskFor(action), stage = action.includes("delivery") ? "s10" : "workspace";
  const body = action === "prepare_workspace" ? { transfers: [], requirements_ref: ref("requirements") }
    : action === "maintain_workspace" ? { purpose: "inspect", original_delivery_ref: ref("original-delivery"), objects: [], report_ref: ref("maintenance") }
      : action === "prepare_delivery" ? { manuscript_ref: ref("manuscript"), package_version: "1", files: [], package_check_ref: ref("package-check") }
        : { preflight_result_hash: FIXTURE_HASH_B, package_version: "1", files: [], script_report_ref: ref("script-report") };
  const contract = productionRoutePolicy("astra_paper_research", action).result_contract!;
  const output = { ...stageOutput(stage), body, coverage: (contract.required_responsibilities as string[]).map(responsibility => ({
    responsibility, input_refs: [ref("authorized-input")], read_scope: "fixture only", limitations: "No real file action claimed",
    check_ref: ref("check"), context_ref: ref(stage) })) };
  const run = await exerciseProductFlow(plugin, { task, output, materialContents: { ...materials, delivery_plan: { files: [] } } });
  assert.equal((run.completed.payload as Record<string, unknown>).action, action);
  assert.equal(run.calls.filter(c => c.child === "submit_exact_gpt_turn_once").length, 1);
  assert.deepEqual((run.completed.payload as Record<string, unknown>).body, body);
  if (stage === "s10") assert(String(run.calls.find(c => c.child === "write_exact_gpt_prompt")!.input.prompt)
    .includes(readFileSync("src/plugins/s10-research-package/delivery-script.py", "utf8")));
}
assert.deepEqual(productionPluginCatalog.flatMap(p => p.accepts).filter(r => r.productId === "astra_paper_research")
  .map(r => r.actionId).sort(), plugin.accepts.map(r => r.actionId).sort());
const roots = readdirSync("src/plugins", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
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
