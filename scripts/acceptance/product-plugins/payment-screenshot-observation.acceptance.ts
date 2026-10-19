import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseConfirmedSubmitRecovery, exerciseProductFlow, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "payment-screenshot-observation");
assert(plugin);
const sequence = [
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
      ? { parameters: { challenge_id: "challenge:1", question_text: "复核支付截图观察" }, reviewPolicy: "manual-accuracy-challenge.v1" as const }
      : { parameters: { reflection_plan_id: "reflection:1", reflection_contract_version: "scheduled-quality-reflection.v1", evidence_ref_catalog: ["receipt:1"] }, reviewPolicy: "scheduled-quality-reflection.v1" as const }
    : { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } };
  const task = buildProductTask(route, fixture);
  const output = review ? { decision: "no_issue", issues: [] } : {
    schema_version: route.result_schema_version, page_kind: "payment_success", payment_app: "alipay",
    success_visible: true, visible_amount_minor_units: 100, reason_code: "VISIBLE_SUCCESS",
  };
  const run = await exerciseProductFlow(plugin, { task, output });
  await exerciseConfirmedSubmitRecovery(plugin, { task, output });
  assert.deepEqual(run.calls.map((call) => call.child), sequence);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：payment-screenshot-observation/u);
  const model = run.calls.find(call => call.child === "select_gpt_model_from_start_v3")!;
  const reasoning = run.calls.find(call => call.child === "select_gpt_reasoning_from_start_v3")!;
  assert.deepEqual({ profileRef: model.input.profile.profileRef,
    startModelDisplayName: model.input.profile.startModelDisplayName,
    requestedReasoningValue: reasoning.input.profile.requestedReasoningValue }, {
    profileRef: "payment-screenshot-observation:chatgpt-latest-reasoning-2",
    startModelDisplayName: "最新", requestedReasoningValue: 2,
  });
  assert.deepEqual(model.input.profile, reasoning.input.profile,
    "payment model and reasoning must consume the same Product profile");
  assert.equal(run.physicalSubmitDispatches, 1);
  const prompt = String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt);
  assert.ok(prompt.includes(JSON.stringify(route.result_contract)), "the actual prompt must consume the unique public format");
  if (review) {
    const issue = { observation: "e\u0301𠮷", extra: { untouched: true } };
    const received = await exerciseProductFlow(plugin, { task, output: { decision: "issues", issues: issue, extra: true } });
    assert.deepEqual(received.completed.payload, { decision: "issues", issues: [issue], extra: true });
    await assert.rejects(exerciseProductFlow(plugin, { task, output: { decision: "invalid", issues: [] } }), /AGENT_REVIEW_DECISION_INVALID/u);
  }
  if (!review) {
    for (const observed of [
      { ...output, page_kind: "other", payment_app: "unknown", success_visible: false, visible_amount_minor_units: null, extra_observation: { untouched: true } },
      { ...output, page_kind: "unrecognized_other", payment_app: null, success_visible: false, visible_amount_minor_units: null },
    ]) {
      const received = await exerciseProductFlow(plugin, { task, output: observed });
      assert.deepEqual(received.completed.payload, observed, "basic reception preserves raw values and unknown fields");
      await exerciseConfirmedSubmitRecovery(plugin, { task, output: observed });
    }
  }
}
process.stdout.write("[ACCEPTANCE][payment-screenshot-observation] PASS\n");
