import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { readTextFile } from "../../core/filesystem.js";

const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";

function createFatalFinding(message: string): Finding {
  return createFinding({
    lawId: "GRASSEYE-STRUCTURED-LOGGING-009-V1",
    file: STARTUP_PATH,
    line: 1,
    severity: "fatal",
    message,
  });
}

function createPhaseResult(findings: Finding[]): InspectorPhase {
  return createPhase(
    "startup-exit-classification",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Startup classifies SIGTERM and exit code 143 as controlled shutdown instead of unexpected failure."
      : "Startup can still misclassify controlled shutdown as unexpected failure.",
  );
}

export async function runStartupExitClassificationChecks(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const text = await readTextFile(pathFromRepoRoot(STARTUP_PATH));
  const hasControlledExitHelper = text.includes('exit.signal === "SIGTERM"')
    && text.includes("exit.code === 143")
    && text.includes("isControlledServiceExit");
  const hasControlledExitPassLog = text.includes('classified local service exit as controlled shutdown');
  const findings = hasControlledExitHelper && hasControlledExitPassLog
    ? []
    : [createFatalFinding("Startup must classify SIGTERM and exit code 143 as controlled shutdown and log that classification explicitly.")];

  return { findings, phase: createPhaseResult(findings) };
}