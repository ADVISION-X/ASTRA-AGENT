import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

const LAW_ID = "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2";
const COMMANDER_FOUNDATION_SCHEMA_FILE = "src/capabilities/commander-console/shared/commander-schema-foundation.ts";
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

function hasTaskStartBindingUpperBound(normalizerText: string, resolverText: string): boolean {
  return hasUpperBound(normalizerText) || hasUpperBound(resolverText);
}

function hasTaskStartBindingDefaultResolution(resolverText: string): boolean {
  return resolverText.includes("?? input.defaultMaxRounds") && resolverText.includes("?? input.defaultMaxMinutes");
}

function inspectCommanderFoundationSchema(project: import("ts-morph").Project): Finding[] {
  const source = project.getSourceFile(COMMANDER_FOUNDATION_SCHEMA_FILE);
  if (!source) {
    return [createMissingSourceFinding(COMMANDER_FOUNDATION_SCHEMA_FILE, "commander schema foundation source")];
  }

  return ["CommanderMaxRoundsSchema", "CommanderMaxMinutesSchema"].flatMap((schemaName) => {
    const initializerText = source.getVariableDeclaration(schemaName)?.getInitializer()?.getText() ?? "";
    if (initializerText.length === 0) {
      return [createPositiveOnlyFinding(COMMANDER_FOUNDATION_SCHEMA_FILE, `${schemaName} declaration`)];
    }
    if (hasUpperBound(initializerText)) {
      return [createUpperBoundFinding(COMMANDER_FOUNDATION_SCHEMA_FILE, `${schemaName} declaration`)];
    }
    return initializerText.includes(".positive()")
      ? []
      : [createPositiveOnlyFinding(COMMANDER_FOUNDATION_SCHEMA_FILE, `${schemaName} declaration`)];
  });
}

function inspectAppRunLimitSettingsSchema(project: import("ts-morph").Project): Finding[] {
  const settingsSource = project.getSourceFile(SETTINGS_SCHEMA_FILE);
  if (!settingsSource) {
    return [createMissingSourceFinding(SETTINGS_SCHEMA_FILE, "app run-limit settings source")];
  }

  const schemaText = settingsSource.getVariableDeclaration("AppRunLimitSettingsSchema")?.getInitializer()?.getText() ?? "";
  if (schemaText.length === 0) {
    return [createPositiveOnlyFinding(SETTINGS_SCHEMA_FILE, "App run-limit settings schema")];
  }

  const findings: Finding[] = [];
  if (hasUpperBound(schemaText)) {
    findings.push(createUpperBoundFinding(SETTINGS_SCHEMA_FILE, "App run-limit settings schema"));
  }
  if ((schemaText.match(/\.positive\(\)/g) ?? []).length < 2) {
    findings.push(createPositiveOnlyFinding(SETTINGS_SCHEMA_FILE, "App run-limit settings schema"));
  }
  return findings;
}

function inspectAppRunLimitSettingsApi(project: import("ts-morph").Project): Finding[] {
  const apiSource = project.getSourceFile(SETTINGS_API_FILE);
  if (!apiSource) {
    return [createMissingSourceFinding(SETTINGS_API_FILE, "app run-limit settings API source")];
  }

  const normalizerText = apiSource.getFunction("normalizePositiveInteger")?.getText() ?? "";
  if (normalizerText.length === 0) {
    return [createPositiveOnlyFinding(SETTINGS_API_FILE, "App run-limit settings API normalizer")];
  }

  const findings: Finding[] = [];
  if (hasUpperBound(normalizerText)) {
    findings.push(createUpperBoundFinding(SETTINGS_API_FILE, "App run-limit settings API normalizer"));
  }
  if (!normalizerText.includes("value >= 1")) {
    findings.push(createPositiveOnlyFinding(SETTINGS_API_FILE, "App run-limit settings API normalizer"));
  }
  return findings;
}

function inspectTaskStartBinding(project: import("ts-morph").Project): Finding[] {
  const bindingSource = project.getSourceFile(START_BINDING_FILE);
  if (!bindingSource) {
    return [createMissingSourceFinding(START_BINDING_FILE, "task start binding source")];
  }

  const normalizerText = bindingSource.getFunction("normalizePositiveInteger")?.getText() ?? "";
  const resolverText = bindingSource.getFunction("resolveStartRunLimits")?.getText() ?? "";
  if (normalizerText.length === 0 || resolverText.length === 0) {
    return [createPositiveOnlyFinding(START_BINDING_FILE, "Task start run-limit normalization")];
  }

  const findings: Finding[] = [];
  if (hasTaskStartBindingUpperBound(normalizerText, resolverText)) {
    findings.push(createUpperBoundFinding(START_BINDING_FILE, "Task start run-limit normalization"));
  }
  if (!normalizerText.includes("value >= 1")) {
    findings.push(createPositiveOnlyFinding(START_BINDING_FILE, "Task start run-limit normalization"));
  }
  if (!hasTaskStartBindingDefaultResolution(resolverText)) {
    findings.push(createPositiveOnlyFinding(START_BINDING_FILE, "Task start run-limit resolution"));
  }
  return findings;
}

export function runAppRunLimitSettingsGovernanceChecks(project: import("ts-morph").Project) {
  const findings: Finding[] = [
    ...inspectCommanderFoundationSchema(project),
    ...inspectAppRunLimitSettingsSchema(project),
    ...inspectAppRunLimitSettingsApi(project),
    ...inspectTaskStartBinding(project),
  ];

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