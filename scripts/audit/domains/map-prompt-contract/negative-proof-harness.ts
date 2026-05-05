import { readFile } from "node:fs/promises";

import { validateMapPackage } from "../../../../src/map-plugins/validation/map-package-validator.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-002-V1";

async function readBuiltinMapPackage(): Promise<Record<string, unknown>> {
  const filePath = pathFromRepoRoot("src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json");
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as Record<string, unknown>;
}

function createHarnessResult(findings: Finding[], summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings,
    phase: createPhase(
      "negative-proof-harness",
      findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
      findings.length === 0,
      summary,
    ),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const basePackage = await readBuiltinMapPackage();

  const missingRefsVariant = structuredClone(basePackage) as Record<string, unknown>;
  const promptBindings = ((missingRefsVariant.promptBindings as { bindings: Array<Record<string, unknown>> }).bindings);
  if (promptBindings[0] === undefined) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/map-plugins/builtins/tiktok-seeding-video-discovery.meta.map-package.json",
      line: 1,
      severity: "fatal",
      message: "Negative proof harness requires at least one prompt binding in the built-in discovery map.",
    }));
    return createHarnessResult(findings, "Map prompt governance negative proof could not construct its attack variants.");
  }
  promptBindings[0].requiredInputRefs = [];

  const rawPromptVariant = structuredClone(basePackage) as Record<string, unknown>;
  rawPromptVariant.rawPrompt = "you should not see this";

  const missingRefsResult = validateMapPackage(missingRefsVariant);
  const rawPromptResult = validateMapPackage(rawPromptVariant);
  const blocked = missingRefsResult.issues.length > 0 && rawPromptResult.issues.length > 0;

  if (!blocked) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: "src/map-plugins/validation/map-package-validator.ts",
      line: 1,
      severity: "fatal",
      message: "Negative proof failed: validator accepted missing requiredInputRefs or rawPrompt injection.",
    }));
  }

  return createHarnessResult(
    findings,
    findings.length === 0
      ? "In-memory negative proof confirms validator rejects missing prompt inputs and raw prompt injection."
      : "Map prompt governance negative proof did not block expected attacks.",
  );
}