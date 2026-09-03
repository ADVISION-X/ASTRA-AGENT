import assert from "../../audit/shared/governance-exam-assert.js";
import { productionPluginCatalog } from "../../../src/lib/local-runtime/production/catalog.js";
import { productionRoutePolicies } from "../../../src/lib/local-runtime/production/route-policy.js";
import { buildProductTask, exerciseProductFlow, routesForPlugin } from "../product-plugin-test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "payment-screenshot-observation");
assert(plugin);
const sequence = [
  "prepare_clean_gpt_chat", "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2", "ensure_exact_gpt_reasoning_tier", "close_gpt_execution_profile",
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
  "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
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
  assert.deepEqual(run.calls.map((call) => call.child), sequence);
  assert.match(String(run.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt), /当前 Product Plugin：payment-screenshot-observation/u);
  assert.equal(run.physicalSubmitDispatches, 1);
}
process.stdout.write("[ACCEPTANCE][payment-screenshot-observation] PASS\n");
