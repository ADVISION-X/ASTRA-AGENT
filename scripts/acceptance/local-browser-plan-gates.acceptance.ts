import assert from "node:assert/strict";

import { assertPlanShape, readExecutionManifest } from "./local-browser-plan-harness.self-test.js";

const manifest = readExecutionManifest();
assertPlanShape(manifest);

const byId = new Map(manifest.work_orders.map((workOrder) => [workOrder.work_order_id, workOrder]));
assert.deepEqual(byId.get("WO-005")?.depends_on, ["WO-002", "WO-006"]);
assert.deepEqual(byId.get("WO-007")?.depends_on, ["WO-002", "WO-005"]);
assert.deepEqual(byId.get("WO-008")?.depends_on, ["WO-005", "WO-006", "WO-007"]);
assert.deepEqual(byId.get("WO-009")?.depends_on, ["WO-008"]);

process.stdout.write(`${JSON.stringify({
  status: "PASS",
  candidate: manifest.candidate_id,
  gates: manifest.decision_gates.map((gate) => gate.decision_gate_id),
  guardedDemolition: "WO-009",
})}\n`);
