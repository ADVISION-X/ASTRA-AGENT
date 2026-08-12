import { parentPort } from "node:worker_threads";

import { runGeneratedPlan } from "./run-generated-plan.js";

if (!parentPort) throw new Error("Generated-plan worker requires a parent port.");

try {
  const result = await runGeneratedPlan();
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
