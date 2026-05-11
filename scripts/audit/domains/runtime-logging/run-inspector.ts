// Runtime Logging — run inspector and print results.
// Supports --self-proof flag for fault-injection validation.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runRuntimeLoggingInspector } from "./inspector.js";
import { clearAuditProjectCache } from "../../core/ts-morph.js";

const ROOT = process.cwd();
const SELF_PROOF = process.argv.includes("--self-proof");

function runAndPrint(label: string): "PASS" | "FAIL" | "WARN" {
  const result = runRuntimeLoggingInspector();
  process.stdout.write(`\n[RUNTIME-LOGGING${label ? " " + label : ""}] Running Runtime Log Spine governance inspection...\n\n`);
  for (const check of result.checks) {
    const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "⚠" : "✗";
    process.stdout.write(`  [${check.checkId}] ${icon} ${check.status} — ${check.question}\n`);
    if (check.status !== "PASS") {
      process.stdout.write(`          ${check.detail}\n`);
    }
  }
  process.stdout.write(`\n[RUNTIME-LOGGING${label ? " " + label : ""}] Overall: ${result.overallStatus}\n\n`);
  return result.overallStatus;
}

if (!SELF_PROOF) {
  const status = runAndPrint("");
  if (status === "FAIL") process.exit(1);
} else {
  // ── Self-Proof: fault-injection validation ────────────────────────────────
  process.stdout.write("[SELF-PROOF] SELF_PROOF_STARTED\n");

  // ── Injection D: replace missionId fallback with randomUUID() in model-call.ts traceId ──
  const MODEL_CALL_PATH = join(ROOT, "src/capabilities/ai/runtime/model-call.ts");
  const modelCallOrig = readFileSync(MODEL_CALL_PATH, "utf8");
  const modelCallMutated = modelCallOrig.replace(
    /trace\?\.traceId \?\? input\.request\.missionId \?\? "no-trace"/g,
    'trace?.traceId ?? randomUUID()'
  );
  if (modelCallMutated === modelCallOrig) {
    process.stdout.write("[SELF-PROOF] WARN: Injection D could not find target text in model-call.ts\n");
  } else {
    writeFileSync(MODEL_CALL_PATH, modelCallMutated, "utf8");
    process.stdout.write("[SELF-PROOF] SELF_PROOF_MUTATION_APPLIED: Injection D (randomUUID() as traceId in model-call.ts)\n");
  }

  // ── Injection E: remove AI_RAW_RESPONSE_DEBUG emit from call-local-model.ts ──
  const CALL_LOCAL_MODEL_PATH = join(ROOT, "src/lib/local-ai/call-local-model.ts");
  const callLocalOrig = readFileSync(CALL_LOCAL_MODEL_PATH, "utf8");
  // Remove the entire .emit block that emits AI_RAW_RESPONSE_DEBUG
  const callLocalMutated = callLocalOrig.replace(
    /\/\/ AI_RAW_RESPONSE_DEBUG[^\n]*\n/g,
    "// AI_RAW_RESPONSE_DEBUG emit removed by self-proof injection\n"
  );
  // If line-based removal didn't work, try removing the emit call containing AI_RAW_RESPONSE_DEBUG
  const AI_RAW_IDENTIFIER = "AI_RAW_RESPONSE_DEBUG";
  const hasRawResponseDebug = callLocalMutated.includes(AI_RAW_IDENTIFIER);
  // Replace the identifier with a different one to break the check
  const callLocalFinalMutated = callLocalOrig.replace(
    new RegExp(AI_RAW_IDENTIFIER, "g"),
    "AI_RAW_RESPONSE_SUPPRESSED_SELF_PROOF"
  );
  if (callLocalFinalMutated === callLocalOrig) {
    process.stdout.write("[SELF-PROOF] WARN: Injection E could not find AI_RAW_RESPONSE_DEBUG in call-local-model.ts\n");
  } else {
    writeFileSync(CALL_LOCAL_MODEL_PATH, callLocalFinalMutated, "utf8");
    process.stdout.write("[SELF-PROOF] SELF_PROOF_MUTATION_APPLIED: Injection E (removed AI_RAW_RESPONSE_DEBUG from call-local-model.ts)\n");
  }

  // ── Run inspector — expect FAIL ──
  clearAuditProjectCache();
  const failStatus = runAndPrint("(SELF-PROOF MUTATED)");
  if (failStatus === "FAIL") {
    process.stdout.write("[SELF-PROOF] SELF_PROOF_EXPECTED_FAIL_OBSERVED\n");
  } else {
    process.stdout.write(`[SELF-PROOF] FATAL: Expected FAIL after mutations but got ${failStatus} — self-proof cannot validate fault detection\n`);
    writeFileSync(MODEL_CALL_PATH, modelCallOrig, "utf8");
    writeFileSync(CALL_LOCAL_MODEL_PATH, callLocalOrig, "utf8");
    process.exit(1);
  }

  // ── Restore ──
  writeFileSync(MODEL_CALL_PATH, modelCallOrig, "utf8");
  writeFileSync(CALL_LOCAL_MODEL_PATH, callLocalOrig, "utf8");
  clearAuditProjectCache();
  process.stdout.write("[SELF-PROOF] SELF_PROOF_RESTORED\n");

  // ── Run inspector again — expect PASS ──
  const passStatus = runAndPrint("(SELF-PROOF RESTORED)");
  if (passStatus === "PASS") {
    process.stdout.write("[SELF-PROOF] SELF_PROOF_FINAL_PASS\n");
  } else {
    process.stdout.write(`[SELF-PROOF] FATAL: Expected PASS after restore but got ${passStatus}\n`);
    process.exit(1);
  }
}

