import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

const LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2";
const SETTINGS_SCHEMA_FILE = "src/lib/local-runtime/app-run-limit-settings.ts";
const SETTINGS_API_FILE = "src/app/app-settings-api-handlers.ts";
const START_BINDING_FILE = "src/lib/local-app-shell/task-start-binding.ts";

function createMissingSourceFinding(file: string, subject: string): Finding {
  return createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message: `Commander run-limit governance audit cannot load ${subject}.` });
}

function createUpperBoundFinding(file: string, subject: string): Finding {
  return createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message: `${subject} must remain positive-only and must not restore a run-limit hard cap.` });
}

function createPositiveOnlyFinding(file: string, subject: string): Finding {
  return createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message: `${subject} must accept positive integers without a fixed upper bound.` });
}

function hasUpperBound(text: string): boolean {
  return text.includes(".max(") || text.includes("<=") || text.includes("Math.min") || text.includes("Math.max");
}

export function runAppRunLimitSettingsGovernanceChecks(project: import("ts-morph").Project) {
  const findings: Finding[] = [];

  const settingsSource = project.getSourceFile(SETTINGS_SCHEMA_FILE);
  if (!settingsSource) {
    findings.push(createMissingSourceFinding(SETTINGS_SCHEMA_FILE, "app run-limit settings source"));
  } else {
    const schemaText = settingsSource.getVariableDeclaration("AppRunLimitSettingsSchema")?.getInitializer()?.getText() ?? "";
    if (schemaText.length === 0) {
      findings.push(createPositiveOnlyFinding(SETTINGS_SCHEMA_FILE, "App run-limit settings schema"));
    } else {
      if (hasUpperBound(schemaText)) {
        findings.push(createUpperBoundFinding(SETTINGS_SCHEMA_FILE, "App run-limit settings schema"));
      }
      if ((schemaText.match(/\.positive\(\)/g) ?? []).length < 2) {
        findings.push(createPositiveOnlyFinding(SETTINGS_SCHEMA_FILE, "App run-limit settings schema"));
      }
    }
  }

  const apiSource = project.getSourceFile(SETTINGS_API_FILE);
  if (!apiSource) {
    findings.push(createMissingSourceFinding(SETTINGS_API_FILE, "app run-limit settings API source"));
  } else {
    const normalizerText = apiSource.getFunction("normalizePositiveInteger")?.getText() ?? "";
    if (normalizerText.length === 0) {
      findings.push(createPositiveOnlyFinding(SETTINGS_API_FILE, "App run-limit settings API normalizer"));
    } else {
      if (hasUpperBound(normalizerText)) {
        findings.push(createUpperBoundFinding(SETTINGS_API_FILE, "App run-limit settings API normalizer"));
      }
      if (!normalizerText.includes("value >= 1")) {
        findings.push(createPositiveOnlyFinding(SETTINGS_API_FILE, "App run-limit settings API normalizer"));
      }
    }
  }

  const bindingSource = project.getSourceFile(START_BINDING_FILE);
  if (!bindingSource) {
    findings.push(createMissingSourceFinding(START_BINDING_FILE, "task start binding source"));
  } else {
    const normalizerText = bindingSource.getFunction("normalizePositiveInteger")?.getText() ?? "";
    const resolverText = bindingSource.getFunction("resolveStartRunLimits")?.getText() ?? "";
    if (normalizerText.length === 0 || resolverText.length === 0) {
      findings.push(createPositiveOnlyFinding(START_BINDING_FILE, "Task start run-limit normalization"));
    } else {
      if (hasUpperBound(normalizerText) || hasUpperBound(resolverText)) {
        findings.push(createUpperBoundFinding(START_BINDING_FILE, "Task start run-limit normalization"));
      }
      if (!normalizerText.includes("value >= 1")) {
        findings.push(createPositiveOnlyFinding(START_BINDING_FILE, "Task start run-limit normalization"));
      }
      if (!resolverText.includes("?? input.defaultMaxRounds") || !resolverText.includes("?? input.defaultMaxMinutes")) {
        findings.push(createPositiveOnlyFinding(START_BINDING_FILE, "Task start run-limit resolution"));
      }
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "app-run-limit-settings-governance",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "App-owned run-limit settings remain positive-only, uncapped, and free of launcher-side clamp logic."
        : "App-owned run-limit settings drifted toward fixed caps or launcher-side clamp logic.",
    ),
  };
}