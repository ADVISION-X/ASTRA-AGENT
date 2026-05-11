// Visual Mission Flow — run inspector and print results.
// Supports --self-proof flag for fault-injection validation.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runVisualMissionFlowInspector } from "./inspector.js";
import { clearAuditProjectCache } from "../../core/ts-morph.js";

const ROOT = process.cwd();
const SELF_PROOF = process.argv.includes("--self-proof");

function runAndPrint(label: string): "PASS" | "FAIL" | "WARN" {
  const result = runVisualMissionFlowInspector();
  process.stdout.write(`\n[VISUAL-MISSION-FLOW${label ? " " + label : ""}] Running mission flow governance inspection...\n\n`);
  for (const check of result.checks) {
    const icon = check.status === "PASS" ? "✓" : check.status === "WARN" ? "⚠" : "✗";
    process.stdout.write(`  [${check.checkId}] ${icon} ${check.status} — ${check.question}\n`);
    if (check.status !== "PASS") {
      process.stdout.write(`          ${check.detail}\n`);
    }
  }
  process.stdout.write(`\n[VISUAL-MISSION-FLOW${label ? " " + label : ""}] Overall: ${result.overallStatus}\n\n`);
  return result.overallStatus;
}

if (!SELF_PROOF) {
  const status = runAndPrint("");
  if (status === "FAIL") process.exit(1);
} else {
  // ── Self-Proof: fault-injection validation ────────────────────────────────
  process.stdout.write("[SELF-PROOF] SELF_PROOF_STARTED\n");

  // ── Injection A: remove SCROLL requirement from product_yes in ai-output.schema.ts ──
  const SCHEMA_PATH = join(ROOT, "src/visual-mission/action-plan/ai-output.schema.ts");
  const schemaOrig = readFileSync(SCHEMA_PATH, "utf8");
  const SCROLL_REQUIRED_TEXT = `    const scrollIdx = actions.findIndex(a => a.actionCode === "SCROLL_BROWSER_VIEWPORT_ONCE");\n    if (saveIdx !== -1 && scrollIdx === -1) {\n      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "product_yes requires SCROLL_BROWSER_VIEWPORT_ONCE after SAVE_CURRENT_VIDEO_EVIDENCE_ONCE to advance to the next video.", path: ["actions"] });\n    }\n    if (saveIdx !== -1 && scrollIdx !== -1 && scrollIdx < saveIdx)`;
  const SCROLL_REQUIRED_AFTER = `    const scrollIdx = actions.findIndex(a => a.actionCode === "SCROLL_BROWSER_VIEWPORT_ONCE");\n    if (saveIdx !== -1 && scrollIdx !== -1 && scrollIdx < saveIdx)`;
  const schemaMutated = schemaOrig.replace(SCROLL_REQUIRED_TEXT, SCROLL_REQUIRED_AFTER);
  if (schemaMutated === schemaOrig) {
    process.stdout.write("[SELF-PROOF] WARN: Injection A could not find target text — schema may already be mutated\n");
  } else {
    writeFileSync(SCHEMA_PATH, schemaMutated, "utf8");
    process.stdout.write("[SELF-PROOF] SELF_PROOF_MUTATION_APPLIED: Injection A (removed product_yes SCROLL requirement)\n");
  }

  // ── Injection B: remove geometryGuardNormalizedClickPoint from dispatch-sequence ──
  const DISPATCH_PATH = join(ROOT, "src/capabilities/orchestration/runtime/dispatch-sequence.ts");
  const dispatchOrig = readFileSync(DISPATCH_PATH, "utf8");
  const dispatchMutated = dispatchOrig.replace("geometryGuardNormalizedClickPoint: guardResult.normalizedClickPoint,", "// geometryGuardNormalizedClickPoint: REMOVED_FOR_SELF_PROOF,");
  if (dispatchMutated === dispatchOrig) {
    process.stdout.write("[SELF-PROOF] WARN: Injection B could not find target text\n");
  } else {
    writeFileSync(DISPATCH_PATH, dispatchMutated, "utf8");
    process.stdout.write("[SELF-PROOF] SELF_PROOF_MUTATION_APPLIED: Injection B (removed geometryGuardNormalizedClickPoint)\n");
  }

  // ── Injection C: replace targetRole comparison with regex in dispatch-sequence ──
  const dispatchForC = readFileSync(DISPATCH_PATH, "utf8");
  const dispatchMutatedC = dispatchForC.replace(
    "const commentPanelOpenAttempted = input.actions.some(a => a.targetRole === \"comments_button\");",
    "const commentPanelOpenAttempted = input.actions.some(a => /comment/i.test(a.reason ?? \"\"));"
  );
  if (dispatchMutatedC === dispatchForC) {
    process.stdout.write("[SELF-PROOF] WARN: Injection C could not find target text\n");
  } else {
    writeFileSync(DISPATCH_PATH, dispatchMutatedC, "utf8");
    process.stdout.write("[SELF-PROOF] SELF_PROOF_MUTATION_APPLIED: Injection C (replaced targetRole with regex)\n");
  }

  // ── Run inspector — expect FAIL ──
  clearAuditProjectCache();
  const failStatus = runAndPrint("(SELF-PROOF MUTATED)");
  if (failStatus === "FAIL") {
    process.stdout.write("[SELF-PROOF] SELF_PROOF_EXPECTED_FAIL_OBSERVED\n");
  } else {
    process.stdout.write(`[SELF-PROOF] FATAL: Expected FAIL after mutations but got ${failStatus} — self-proof cannot validate fault detection\n`);
    // Restore before exiting
    writeFileSync(SCHEMA_PATH, schemaOrig, "utf8");
    writeFileSync(DISPATCH_PATH, dispatchOrig, "utf8");
    process.exit(1);
  }

  // ── Restore ──
  writeFileSync(SCHEMA_PATH, schemaOrig, "utf8");
  writeFileSync(DISPATCH_PATH, dispatchOrig, "utf8");
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

