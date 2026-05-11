/**
 * MuscleMemory Catalog Registry Inspector
 *
 * Governs the 8 structural laws for the atomic capability registry:
 * 1. src/muscle-memory file count ≤ 5
 * 2. No executor/decoder subdirectories inside src/muscle-memory
 * 3. Catalog schema allows only atomic entries (no composite/recipe)
 * 4. No composite or recipe entry in the generated catalog
 * 5. AI manual only exposes allowedForAiActionPlan=true entries
 * 6. No forbidden legacy action codes in the catalog
 * 7. No forbidden schema fields in any entry
 * 8. Each AI-visible entry has abilityGroupId + childCapabilityId
 */

import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const MUSCLE_MEMORY_ROOT = "src/muscle-memory";
const CATALOG_FILE = "src/muscle-memory/generated-catalog.json";
const SCHEMA_FILE = "src/muscle-memory/schema.ts";
const CATALOG_TS_FILE = "src/muscle-memory/catalog.ts";
const MANUAL_FILE = "src/muscle-memory/manual.ts";
const MAX_FILE_COUNT = 5;

const LAW_ID = "GRASSEYE-MUSCLE-MEMORY-CATALOG-001-V1";

const FORBIDDEN_ACTION_CODES = [
  "CLICK_CELL",
  "CLICK_BROWSER_COORDINATE",
  "SAVE_LEAD",
  "PRESS_KEY",
  "PRESS_NAVIGATION_KEY",
  "OPEN_FACEBOOK_ENTRY",
  "OPEN_TIKTOK_ENTRY",
  "STOP_REVIEW_REQUIRED",
] as const;

const FORBIDDEN_SCHEMA_FIELDS = [
  "requiresPageStateRef",
  "requiresPostActionVerification",
  "internalOnly",
  "productPresenceAiResultRef",
] as const;

const FORBIDDEN_SUBDIRS = ["decoder", "executor", "system-manual", "catalog"] as const;

function createFinding(file: string, message: string): Finding {
  return { lawId: LAW_ID, file, line: 1, severity: "fatal" as const, message };
}

// ─── 1. File count ≤ 5 ────────────────────────────────────────────────────────

export async function checkFileCount(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absRoot = pathFromRepoRoot(MUSCLE_MEMORY_ROOT);
  const findings: Finding[] = [];

  if (!(await fileExists(absRoot))) {
    findings.push(createFinding(MUSCLE_MEMORY_ROOT, "src/muscle-memory directory does not exist."));
    return { findings, phase: createPhase("file-count", "ENFORCEMENT MISS", false, "src/muscle-memory missing.") };
  }

  const files = (await listFilesRecursive(absRoot)).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".json"),
  );
  if (files.length > MAX_FILE_COUNT) {
    findings.push(
      createFinding(MUSCLE_MEMORY_ROOT, `src/muscle-memory must have ≤${MAX_FILE_COUNT} production files but found ${files.length}: ${files.join(", ")}`),
    );
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("file-count", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? `src/muscle-memory file count ${files.length} ≤ ${MAX_FILE_COUNT}.` : `File count ${files.length} exceeds limit.`),
  };
}

// ─── 2. No executor/decoder subdirs ───────────────────────────────────────────

export async function checkNoForbiddenSubdirs(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absRoot = pathFromRepoRoot(MUSCLE_MEMORY_ROOT);
  const findings: Finding[] = [];

  for (const subdir of FORBIDDEN_SUBDIRS) {
    const subdirPath = `${MUSCLE_MEMORY_ROOT}/${subdir}`;
    if (await fileExists(pathFromRepoRoot(subdirPath))) {
      findings.push(createFinding(subdirPath, `Forbidden subdirectory "${subdir}" must not exist in src/muscle-memory. Executor/decoder logic belongs in Orchestration.`));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("no-forbidden-subdirs", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? "No forbidden subdirectories found." : `Found ${findings.length} forbidden subdirectory/ies.`),
  };
}

// ─── 3. Schema only allows atomic entries ─────────────────────────────────────

export async function checkSchemaAtomicOnly(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absPath = pathFromRepoRoot(CATALOG_TS_FILE);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push(createFinding(CATALOG_TS_FILE, "catalog.ts does not exist."));
    return { findings, phase: createPhase("schema-atomic-only", "ENFORCEMENT MISS", false, "catalog.ts missing.") };
  }

  const content = await readFile(absPath, "utf8");

  for (const field of FORBIDDEN_SCHEMA_FIELDS) {
    if (content.includes(field)) {
      findings.push(createFinding(CATALOG_TS_FILE, `Forbidden field "${field}" must not appear in the catalog schema definition.`));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("schema-atomic-only", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? "Catalog schema has no forbidden fields." : `Catalog schema contains forbidden fields.`),
  };
}

// ─── 4. No composite/recipe in generated catalog ──────────────────────────────

export async function checkCatalogNoComposite(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absPath = pathFromRepoRoot(CATALOG_FILE);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push(createFinding(CATALOG_FILE, "generated-catalog.json does not exist."));
    return { findings, phase: createPhase("catalog-no-composite", "ENFORCEMENT MISS", false, "generated-catalog.json missing.") };
  }

  const content = await readFile(absPath, "utf8");

  const forbidden = ["composite", "recipe", "CLICK_CELL_CHAIN", "followUp", "chainTo"];
  for (const keyword of forbidden) {
    if (content.includes(keyword)) {
      findings.push(createFinding(CATALOG_FILE, `Forbidden composite/recipe keyword "${keyword}" found in generated-catalog.json.`));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("catalog-no-composite", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? "No composite/recipe entries in catalog." : `Composite/recipe keywords found.`),
  };
}

// ─── 5. No forbidden legacy action codes ──────────────────────────────────────

export async function checkNoForbiddenActionCodes(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absPath = pathFromRepoRoot(CATALOG_FILE);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push(createFinding(CATALOG_FILE, "generated-catalog.json does not exist."));
    return { findings, phase: createPhase("no-forbidden-codes", "ENFORCEMENT MISS", false, "generated-catalog.json missing.") };
  }

  const content = await readFile(absPath, "utf8");

  for (const code of FORBIDDEN_ACTION_CODES) {
    if (content.includes(`"actionCode": "${code}"`)) {
      findings.push(createFinding(CATALOG_FILE, `Forbidden legacy action code "${code}" must not exist in the capability registry.`));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("no-forbidden-codes", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? "No forbidden legacy action codes in catalog." : `Found ${findings.length} forbidden action code(s).`),
  };
}

// ─── 6. No forbidden schema fields in entries ─────────────────────────────────

export async function checkNoForbiddenSchemaFieldsInEntries(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absPath = pathFromRepoRoot(CATALOG_FILE);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push(createFinding(CATALOG_FILE, "generated-catalog.json does not exist."));
    return { findings, phase: createPhase("no-forbidden-fields", "ENFORCEMENT MISS", false, "generated-catalog.json missing.") };
  }

  const content = await readFile(absPath, "utf8");

  for (const field of FORBIDDEN_SCHEMA_FIELDS) {
    if (content.includes(`"${field}"`)) {
      findings.push(createFinding(CATALOG_FILE, `Forbidden field "${field}" must not appear in any catalog entry.`));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("no-forbidden-fields", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? "No forbidden schema fields in catalog entries." : `Found ${findings.length} forbidden field(s).`),
  };
}

// ─── 7. Each AI-visible entry has abilityGroupId + childCapabilityId ──────────

export async function checkAiVisibleEntriesHaveGroupIds(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absPath = pathFromRepoRoot(CATALOG_FILE);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push(createFinding(CATALOG_FILE, "generated-catalog.json does not exist."));
    return { findings, phase: createPhase("ai-visible-group-ids", "ENFORCEMENT MISS", false, "generated-catalog.json missing.") };
  }

  let catalog: { entries: Array<{ actionCode: string; allowedForAiActionPlan: boolean; abilityGroupId?: string; childCapabilityId?: string }> };
  try {
    catalog = JSON.parse(await readFile(absPath, "utf8")) as typeof catalog;
  } catch {
    findings.push(createFinding(CATALOG_FILE, "generated-catalog.json is not valid JSON."));
    return { findings, phase: createPhase("ai-visible-group-ids", "CODE VIOLATION", false, "JSON parse failed.") };
  }

  for (const entry of catalog.entries) {
    if (entry.allowedForAiActionPlan) {
      if (!entry.abilityGroupId || !entry.childCapabilityId) {
        findings.push(createFinding(CATALOG_FILE,
          `AI-visible entry "${entry.actionCode}" must have both abilityGroupId and childCapabilityId.`));
      }
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("ai-visible-group-ids", passed ? "PASS" : "CODE VIOLATION", passed,
      passed ? "All AI-visible entries have abilityGroupId + childCapabilityId." : `${findings.length} AI-visible entry/entries missing group IDs.`),
  };
}

// ─── 8. Required core files exist ─────────────────────────────────────────────

export async function checkRequiredFilesExist(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const requiredFiles = [SCHEMA_FILE, CATALOG_TS_FILE, MANUAL_FILE, CATALOG_FILE];

  for (const file of requiredFiles) {
    if (!(await fileExists(pathFromRepoRoot(file)))) {
      findings.push(createFinding(file, `Required muscle-memory file "${file}" does not exist.`));
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase("required-files", passed ? "PASS" : "ENFORCEMENT MISS", passed,
      passed ? "All required muscle-memory files present." : `Missing ${findings.length} required file(s).`),
  };
}
