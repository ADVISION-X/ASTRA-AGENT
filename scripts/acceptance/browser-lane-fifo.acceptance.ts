import { readFileSync } from "node:fs";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

const lane = readFileSync("src/lib/browser/infrastructure/browser-lane-coordinator.ts", "utf8");
const store = readFileSync("src/lib/browser/exact-target/browser-mutation-store.ts", "utf8");
const actor = readFileSync("src/lib/browser/exact-target/browser-command-actor.ts", "utf8");

assert.match(lane, /private readonly queue: LaneWaiter\[\] = \[\]/u,
  "Browser lane must remain one process-level queue");
assert.match(lane, /BROWSER_PROVIDER_PROBE_INTERVAL_MS = 30_000/u,
  "Browser FIFO must own the one shared 30-second Provider probe gate");
assert.match(lane, /waiter\.purpose === "provider-probe"/u,
  "only Provider page probes may be held by the shared qualification gate");
assert.doesNotMatch(lane, /providerProbeQueue|providerWaitQueue/u,
  "Provider probes must not create a second queue");
assert.doesNotMatch(lane, /\.\.\.lease/u,
  "Browser FIFO wrappers must preserve the lease's live Document getter");
assert.doesNotMatch(lane, /quarantine|Recovery|recoveryFor|reconciliation/u,
  "Browser lane must not recover or quarantine an old attempt");
assert.match(store, /where job_id=\? and attempt_id=\?/u,
  "Browser mutation lookup must bind the current attempt");
assert.doesNotMatch(store, /atomicStepRecovery|callRecoveryScope|reconciliationScope/u,
  "Browser store must expose no recovery consumer");
assert.match(actor, /dispatchedForBinding/u,
  "pending mutations must be scoped to the current binding");
assert.doesNotMatch(actor, /dispatchedForJob/u,
  "a prior attempt must never block the job-wide lane");

console.log("browser lane FIFO disposable-attempt acceptance passed");
