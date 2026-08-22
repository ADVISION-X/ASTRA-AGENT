import assert from "node:assert/strict";
import { BROWSER_ERROR_CODES } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { runLocalBrowserAtomicInspectorAttacks } from "./atomic-if-and-then-inspector.attacks.js";

const expected = [
  "BROWSER_INSTALL_INVALID", "BROWSER_HOST_UNAVAILABLE", "BROWSER_ORIGIN_REJECTED", "BROWSER_EXTENSION_UNVERIFIED",
  "BROWSER_ACTIVATION_TUPLE_INVALID", "BROWSER_AUTH_TRANSCRIPT_INVALID", "BROWSER_CAPABILITY_REJECTED", "BROWSER_PROFILE_UNVERIFIED",
  "BROWSER_PROCESS_UNVERIFIED", "BROWSER_POLICY_UNVERIFIED", "BROWSER_LIVENESS_EXPIRED", "BROWSER_WORKER_FENCE_INVALID",
  "BROWSER_DUAL_ACTIVE_WORKER", "BROWSER_BACKPRESSURE", "BROWSER_FILE_GRANT_INVALID", "BROWSER_ROLLBACK_REJECTED",
  "BROWSER_REVOCATION_REJECTED", "BROWSER_COMMAND_PERMIT_INVALID", "BROWSER_TARGET_INVALID", "BROWSER_DOCUMENT_INVALID",
  "BROWSER_DEVTOOLS_CONFLICT", "BROWSER_OUTCOME_UNKNOWN", "BROWSER_REPAIR_REQUIRED",
] as const satisfies readonly (typeof BROWSER_ERROR_CODES)[number][];
assert.equal(BROWSER_ERROR_CODES.length, expected.length);
for (const code of expected) assert.equal(BROWSER_ERROR_CODES.includes(code), true, `missing mutant target ${code}`);
runLocalBrowserAtomicInspectorAttacks();
console.log("LOCAL_BROWSER_RULE_MUTANTS_ACCEPTANCE_PASS");
