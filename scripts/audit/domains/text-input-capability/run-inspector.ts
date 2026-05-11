import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  FORBIDDEN_CHILD_IDS,
  FORBIDDEN_FIELDS,
  FORBIDDEN_FILE_PATTERNS,
  FORBIDDEN_PORT_METHODS,
  LAW_IDS,
  MAX_PRODUCTION_FILE_COUNT,
  REQUIRED_CHILD_IDS,
  REQUIRED_PORT_METHODS,
  TEXT_INPUT_LAW_FILE,
  TEXT_INPUT_PRODUCTION_ROOT,
} from "./config.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function readProductionFile(rel: string): Promise<string | null> {
  const abs = pathFromRepoRoot(rel);
  if (!(await fileExists(abs))) return null;
  return readFile(abs, "utf8");
}

// ─── 1. File count ───────────────────────────────────────────────────────────

export async function checkFileCount(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const abs = pathFromRepoRoot(TEXT_INPUT_PRODUCTION_ROOT);
  const findings: Finding[] = [];

  if (!(await fileExists(abs))) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: TEXT_INPUT_PRODUCTION_ROOT,
      line: 1,
      severity: "fatal",
      message: "src/capabilities/text-input directory does not exist.",
    });
    return {
      findings,
      phase: createPhase("file-count", "ENFORCEMENT MISS", false, "text-input production root missing."),
    };
  }

  const files = await listFilesRecursive(abs, { extensions: [".ts", ".tsx", ".js", ".jsx", ".json"] });
  const count = files.length;

  if (count > MAX_PRODUCTION_FILE_COUNT) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: TEXT_INPUT_PRODUCTION_ROOT,
      line: 1,
      severity: "fatal",
      message: `text-input has ${count} files (max allowed: ${MAX_PRODUCTION_FILE_COUNT}). Delete-and-rebuild required.`,
    });
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "file-count",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? `text-input file count: ${count} (within limit of ${MAX_PRODUCTION_FILE_COUNT}).`
        : `text-input file count ${count} exceeds limit ${MAX_PRODUCTION_FILE_COUNT}.`,
    ),
  };
}

// ─── 2. Active children ───────────────────────────────────────────────────────

export async function checkActiveChildren(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const registryPath = `${TEXT_INPUT_PRODUCTION_ROOT}/registry.ts`;
  const content = await readProductionFile(registryPath);
  const findings: Finding[] = [];

  if (content === null) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: registryPath,
      line: 1,
      severity: "fatal",
      message: "text-input registry.ts does not exist.",
    });
    return {
      findings,
      phase: createPhase("active-children", "ENFORCEMENT MISS", false, "text-input registry.ts missing."),
    };
  }

  for (const childId of REQUIRED_CHILD_IDS) {
    if (!content.includes(childId)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: registryPath,
        line: 1,
        severity: "fatal",
        message: `Required active child "${childId}" is not registered in text-input registry.`,
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "active-children",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "text-input registry contains all 3 required atomic children."
        : `text-input active children check failed.`,
    ),
  };
}

// ─── 3. Forbidden children ────────────────────────────────────────────────────

export async function checkForbiddenChildren(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const abs = pathFromRepoRoot(TEXT_INPUT_PRODUCTION_ROOT);
  const findings: Finding[] = [];

  if (!(await fileExists(abs))) {
    return {
      findings,
      phase: createPhase("forbidden-children", "PASS", true, "No text-input production root — no forbidden children possible."),
    };
  }

  const files = await listFilesRecursive(abs, { extensions: [".ts", ".tsx"] });

  for (const forbiddenId of FORBIDDEN_CHILD_IDS) {
    const hit = files.find((f) => f.includes(forbiddenId));
    if (hit) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: hit,
        line: 1,
        severity: "fatal",
        message: `Forbidden retired child capability "${forbiddenId}" file found in text-input production. Physical delete required.`,
      });
    }
  }

  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    const hit = files.find((f) => f.toLowerCase().includes(pattern));
    if (hit) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: hit,
        line: 1,
        severity: "fatal",
        message: `Forbidden file pattern "${pattern}" found in text-input: ${hit}. Physical delete required.`,
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-children",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No forbidden retired children or file patterns found in text-input production."
        : `Forbidden file patterns found in text-input.`,
    ),
  };
}

// ─── 4. Forbidden fields ──────────────────────────────────────────────────────

export async function checkForbiddenFields(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const abs = pathFromRepoRoot(TEXT_INPUT_PRODUCTION_ROOT);
  const findings: Finding[] = [];

  if (!(await fileExists(abs))) {
    return {
      findings,
      phase: createPhase("forbidden-fields", "PASS", true, "No production root."),
    };
  }

  const files = await listFilesRecursive(abs, { extensions: [".ts", ".tsx"] });

  for (const file of files) {
    const content = await readFile(pathFromRepoRoot(file), "utf8");
    for (const field of FORBIDDEN_FIELDS) {
      if (content.includes(field)) {
        findings.push({
          lawId: LAW_IDS.PROOF,
          file,
          line: 1,
          severity: "fatal",
          message: `Forbidden field "${field}" found in text-input production file: ${file}.`,
        });
      }
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-fields",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "No forbidden fields in text-input production."
        : `Forbidden fields found in text-input.`,
    ),
  };
}

// ─── 5. Primitive port surface ────────────────────────────────────────────────

export async function checkPrimitivePort(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const portPath = `${TEXT_INPUT_PRODUCTION_ROOT}/ports/text-input-primitive-port.ts`;
  const content = await readProductionFile(portPath);
  const findings: Finding[] = [];

  if (content === null) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: portPath,
      line: 1,
      severity: "fatal",
      message: "text-input-primitive-port.ts does not exist.",
    });
    return {
      findings,
      phase: createPhase("primitive-port", "ENFORCEMENT MISS", false, "Port file missing."),
    };
  }

  for (const method of REQUIRED_PORT_METHODS) {
    if (!content.includes(method)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: portPath,
        line: 1,
        severity: "fatal",
        message: `Required port method "${method}" not found in text-input-primitive-port.ts.`,
      });
    }
  }

  for (const method of FORBIDDEN_PORT_METHODS) {
    if (content.includes(method)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: portPath,
        line: 1,
        severity: "fatal",
        message: `Forbidden port method "${method}" found in text-input-primitive-port.ts. Only typeText/pressKey/clearFocusedInput are allowed.`,
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "primitive-port",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Primitive port exposes only typeText/pressKey/clearFocusedInput."
        : `Primitive port surface violation.`,
    ),
  };
}

// ─── 6. Proof integrity ───────────────────────────────────────────────────────

export async function checkProofIntegrity(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const proofForbidden = [
    "pageReady",
    "pageCorrect",
    "actionVerified",
    "semanticSuccess",
    "businessSuccess",
    "postActionVerification",
  ];
  const abs = pathFromRepoRoot(TEXT_INPUT_PRODUCTION_ROOT);
  const findings: Finding[] = [];

  if (!(await fileExists(abs))) {
    return {
      findings,
      phase: createPhase("proof-integrity", "PASS", true, "No production root."),
    };
  }

  const files = await listFilesRecursive(abs, { extensions: [".ts"] });

  for (const file of files) {
    const content = await readFile(pathFromRepoRoot(file), "utf8");
    for (const forbidden of proofForbidden) {
      if (content.includes(forbidden)) {
        findings.push({
          lawId: LAW_IDS.PROOF,
          file,
          line: 1,
          severity: "fatal",
          message: `Forbidden proof/semantic field "${forbidden}" found in ${file}. Proof must only certify primitive write truth.`,
        });
      }
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "proof-integrity",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Text Input proof contains only primitive write truth."
        : `Text Input proof contains forbidden semantic truth fields.`,
    ),
  };
}

// ─── 7. Law baseline ─────────────────────────────────────────────────────────

export async function checkLawBaseline(): Promise<{
  findings: Finding[];
  phase: InspectorPhase;
}> {
  const findings: Finding[] = [];
  const lawPath = pathFromRepoRoot(TEXT_INPUT_LAW_FILE);

  if (!(await fileExists(lawPath))) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: TEXT_INPUT_LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Text Input law file does not exist.",
    });
    return {
      findings,
      phase: createPhase("law-baseline", "LAW GAP", false, "Law file missing."),
    };
  }

  const content = await readFile(lawPath, "utf8");
  for (const childId of REQUIRED_CHILD_IDS) {
    if (!content.includes(childId)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: TEXT_INPUT_LAW_FILE,
        line: 1,
        severity: "fatal",
        message: `Law file does not mention required child capability "${childId}".`,
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "law-baseline",
      passed ? "PASS" : "LAW GAP",
      passed,
      passed
        ? "Text Input law baseline passed."
        : `Text Input law does not enumerate all required atomic children.`,
    ),
  };
}
