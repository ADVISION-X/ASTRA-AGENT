/**
 * Commander Console Capability — Check Functions
 *
 * 8 check functions answering the governance questions:
 *   1. Are all 7 required child IDs present in children.ts?
 *   2. Are all forbidden child IDs absent from the production root?
 *   3. Are forbidden fields absent from schema.ts?
 *   4. Does the production root have at most MAX_PRODUCTION_FILE_COUNT files?
 *   5. Does index.ts export createCommanderConsoleAbilityGroup?
 *   6. Does ability-group.ts import from registry.js and not from read-models?
 *   7. Are there no imports from deleted shared/commander-view-types?
 *   8. Does envelope.ts define CommandTransportPort with sendHumanCommandEnvelope?
 */

import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  COMMANDER_CONSOLE_PRODUCTION_ROOT,
  REQUIRED_CHILD_IDS,
  FORBIDDEN_CHILD_IDS,
  FORBIDDEN_FIELDS,
  LAW_IDS,
  MAX_PRODUCTION_FILE_COUNT,
  commanderConsoleInspectionConstants as config,
} from "./config.js";

type CheckResult = { findings: Finding[]; phase: InspectorPhase };

const readSource = async (relativePath: string): Promise<string> => {
  const absPath = pathFromRepoRoot(relativePath);
  if (!(await fileExists(absPath))) return "";
  return readFile(absPath, "utf-8");
};

// --- Check 1: All 7 required child IDs present in children.ts

export async function checkRequiredChildIdsPresent(): Promise<CheckResult> {
  const source = await readSource(config.CHILDREN_PATH);
  const findings: Finding[] = [];
  for (const childId of REQUIRED_CHILD_IDS) {
    if (!source.includes('"' + childId + '"')) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: config.CHILDREN_PATH,
        line: 1,
        severity: "error",
        message: 'Required child capability ID missing from children.ts: "' + childId + '"',
        recommendedAction: 'Add "' + childId + '" child executor to children.ts',
      });
    }
  }
  return {
    findings,
    phase: createPhase("required-child-ids", findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, "All 7 required child IDs present in children.ts"),
  };
}

// --- Check 2: All forbidden child IDs absent from production root

export async function checkForbiddenChildIdsAbsent(): Promise<CheckResult> {
  const absRoot = pathFromRepoRoot(COMMANDER_CONSOLE_PRODUCTION_ROOT);
  if (!(await fileExists(absRoot))) {
    return {
      findings: [{
        lawId: LAW_IDS.STRUCTURE,
        file: COMMANDER_CONSOLE_PRODUCTION_ROOT,
        line: 1,
        severity: "fatal",
        message: "commander-console production root does not exist.",
      }],
      phase: createPhase("forbidden-child-ids-absent", "CODE VIOLATION", false, "Production root missing"),
    };
  }
  const files = await listFilesRecursive(absRoot, { extensions: [".ts", ".js"] });
  const sources = await Promise.all(files.map((f) => readFile(f, "utf-8").catch(() => "")));
  const allSource = sources.join("\n");
  const findings: Finding[] = [];
  for (const forbiddenId of FORBIDDEN_CHILD_IDS) {
    if (allSource.includes('"' + forbiddenId + '"')) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: COMMANDER_CONSOLE_PRODUCTION_ROOT,
        line: 1,
        severity: "error",
        message: 'Forbidden child capability ID found in production root: "' + forbiddenId + '"',
        recommendedAction: 'Remove "' + forbiddenId + '" -- it was deleted in the rebuild.',
      });
    }
  }
  return {
    findings,
    phase: createPhase("forbidden-child-ids-absent", findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, "No forbidden child IDs in production root"),
  };
}

// --- Check 3: Forbidden fields absent from schema.ts

export async function checkForbiddenFieldsAbsentFromSchema(): Promise<CheckResult> {
  const source = await readSource(config.SCHEMA_PATH);
  const findings: Finding[] = [];
  for (const field of FORBIDDEN_FIELDS) {
    if (source.includes(field)) {
      findings.push({
        lawId: LAW_IDS.BOUNDARY,
        file: config.SCHEMA_PATH,
        line: 1,
        severity: "error",
        message: 'Forbidden field found in schema.ts: "' + field + '"',
        recommendedAction: 'Remove "' + field + '" -- Commander is the human cockpit, not the candidate/map engine.',
      });
    }
  }
  return {
    findings,
    phase: createPhase("forbidden-fields-absent", findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, "No forbidden fields in schema.ts"),
  };
}

// --- Check 4: Production file count <= MAX_PRODUCTION_FILE_COUNT

export async function checkProductionFileCount(): Promise<CheckResult> {
  const absRoot = pathFromRepoRoot(COMMANDER_CONSOLE_PRODUCTION_ROOT);
  if (!(await fileExists(absRoot))) {
    return {
      findings: [],
      phase: createPhase("production-file-count", "CODE VIOLATION", false, "Production root not found -- cannot count files"),
    };
  }
  const files = await listFilesRecursive(absRoot, { extensions: [".ts", ".js", ".json", ".md"] });
  const count = files.length;
  const passed = count <= MAX_PRODUCTION_FILE_COUNT;
  const findings: Finding[] = passed ? [] : [{
    lawId: LAW_IDS.STRUCTURE,
    file: COMMANDER_CONSOLE_PRODUCTION_ROOT,
    line: 1,
    severity: "error",
    message: "Production root has " + count + " files, exceeds max of " + MAX_PRODUCTION_FILE_COUNT,
    recommendedAction: "Delete non-canonical files from " + COMMANDER_CONSOLE_PRODUCTION_ROOT + ". Only 9 core files should exist.",
  }];
  return {
    findings,
    phase: createPhase("production-file-count", passed ? "PASS" : "CODE VIOLATION", passed, "Production root has " + count + " files (max " + MAX_PRODUCTION_FILE_COUNT + ")"),
  };
}

// --- Check 5: index.ts exports createCommanderConsoleAbilityGroup

export async function checkIndexExportsFactory(): Promise<CheckResult> {
  const source = await readSource(config.INDEX_PATH);
  const passed = source.includes("createCommanderConsoleAbilityGroup");
  const findings: Finding[] = passed ? [] : [{
    lawId: LAW_IDS.STRUCTURE,
    file: config.INDEX_PATH,
    line: 1,
    severity: "error",
    message: "index.ts does not export createCommanderConsoleAbilityGroup",
    recommendedAction: "Add: export { createCommanderConsoleAbilityGroup } from './ability-group.js'",
  }];
  return {
    findings,
    phase: createPhase("index-exports-factory", passed ? "PASS" : "CODE VIOLATION", passed, "index.ts exports createCommanderConsoleAbilityGroup"),
  };
}

// --- Check 6: ability-group.ts imports registry, not read-models

export async function checkAbilityGroupImports(): Promise<CheckResult> {
  const source = await readSource(config.ABILITY_GROUP_PATH);
  const findings: Finding[] = [];
  const forbiddenImports = [
    "read-model",
    "audit-read-model",
    "forensics-read-model",
    "health-read-model",
    "mission-read-model",
    "runtime-proof-read-model",
    "commander-view-types",
    "commander-view-schema",
  ];
  for (const forbidden of forbiddenImports) {
    if (source.includes(forbidden)) {
      findings.push({
        lawId: LAW_IDS.BOUNDARY,
        file: config.ABILITY_GROUP_PATH,
        line: 1,
        severity: "error",
        message: 'ability-group.ts imports from forbidden read-model module: "' + forbidden + '"',
        recommendedAction: "Commander ability-group must only import from schema.js, registry.js, result.js, contract.js",
      });
    }
  }
  if (!source.includes("registry")) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: config.ABILITY_GROUP_PATH,
      line: 1,
      severity: "error",
      message: "ability-group.ts does not import from registry",
      recommendedAction: "Import createCommanderRegistry from ./registry.js",
    });
  }
  return {
    findings,
    phase: createPhase("ability-group-imports", findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, "ability-group.ts imports only canonical modules"),
  };
}

// --- Check 7: No imports from deleted shared/commander-view-types

export async function checkNoDeletedSharedViewTypesImport(): Promise<CheckResult> {
  const absRoot = pathFromRepoRoot(COMMANDER_CONSOLE_PRODUCTION_ROOT);
  if (!(await fileExists(absRoot))) {
    return {
      findings: [],
      phase: createPhase("no-deleted-view-types-import", "PASS", true, "Production root not found -- skipping"),
    };
  }
  const files = await listFilesRecursive(absRoot, { extensions: [".ts", ".js"] });
  const sources = await Promise.all(files.map(async (f) => ({ file: f, source: await readFile(f, "utf-8").catch(() => "") })));
  const findings: Finding[] = [];
  for (const { file, source } of sources) {
    if (source.includes("commander-view-types") || source.includes("commander-view-schema")) {
      const relPath = file.replace(process.cwd() + "/", "");
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: relPath,
        line: 1,
        severity: "error",
        message: "File imports from deleted commander-view-types or commander-view-schema",
        recommendedAction: "Remove import -- commander-console no longer owns the dashboard view type.",
      });
    }
  }
  return {
    findings,
    phase: createPhase("no-deleted-view-types-import", findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, "No imports from deleted view types in production root"),
  };
}

// --- Check 8: envelope.ts defines CommandTransportPort with sendHumanCommandEnvelope

export async function checkEnvelopeDefinesTransportPort(): Promise<CheckResult> {
  const source = await readSource(config.ENVELOPE_PATH);
  const findings: Finding[] = [];
  if (!source.includes("CommandTransportPort")) {
    findings.push({
      lawId: LAW_IDS.BOUNDARY,
      file: config.ENVELOPE_PATH,
      line: 1,
      severity: "error",
      message: "envelope.ts does not define CommandTransportPort",
      recommendedAction: "Add CommandTransportPort interface with sendHumanCommandEnvelope",
    });
  }
  if (!source.includes("sendHumanCommandEnvelope")) {
    findings.push({
      lawId: LAW_IDS.BOUNDARY,
      file: config.ENVELOPE_PATH,
      line: 1,
      severity: "error",
      message: "envelope.ts CommandTransportPort does not define sendHumanCommandEnvelope",
      recommendedAction: "CommandTransportPort must have sendHumanCommandEnvelope(envelope): Promise<CommandTransportResult>",
    });
  }
  return {
    findings,
    phase: createPhase("envelope-transport-port", findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, "envelope.ts defines CommandTransportPort with sendHumanCommandEnvelope"),
  };
}
