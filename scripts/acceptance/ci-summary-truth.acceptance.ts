import assert from "node:assert/strict";

import {
  CANONICAL_READY_PHASES,
  resolveAcceptanceLeaves,
  validatePhaseReceipts,
} from "../audit/domains/audit-system/canonical-quality-plan.js";

const passing = CANONICAL_READY_PHASES.map((phaseId) => ({ phaseId, outcome: "PASS" as const }));
assert.deepEqual(validatePhaseReceipts(passing), []);
assert.ok(validatePhaseReceipts(passing.slice(1)).includes("CI_PHASE_SET_OR_ORDER_MISMATCH"));
assert.ok(validatePhaseReceipts([...passing.slice(0, 3), { phaseId: passing[3]!.phaseId, outcome: "FAIL" }, ...passing.slice(4)]).includes("CI_PHASE_FAILED:audit-system-mutants"));
assert.throws(() => resolveAcceptanceLeaves({ a: "npm run b", b: "npm run a" }, "a"), /ACCEPTANCE_SCRIPT_CYCLE/u);
assert.throws(() => resolveAcceptanceLeaves({ a: "node ok.js || true" }, "a"), /ACCEPTANCE_SHELL_AMBIGUOUS/u);
console.log("ci-summary-truth-acceptance-ok");
