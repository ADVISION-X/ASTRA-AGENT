import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  FORBIDDEN_CHILD_IDS,
  FORBIDDEN_FIELDS,
  LAW_IDS,
  MOUSE_CLICK_LAW_FILE,
  MOUSE_CLICK_PRODUCTION_ROOT,
  MAX_PRODUCTION_FILE_COUNT,
  REQUIRED_CHILD_IDS,
} from "./config.js";

// ─── 1. Registry child check ──────────────────────────────────────────────────

async function checkRegistryChildren(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const registryPath = `${MOUSE_CLICK_PRODUCTION_ROOT}/registry.ts`;
  const absPath = pathFromRepoRoot(registryPath);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: registryPath,
      line: 1,
      severity: "fatal",
      message: "mouse-click registry.ts does not exist.",
    });
    return {
      findings,
      phase: createPhase("registry-children", "ENFORCEMENT MISS", false, "mouse-click registry.ts is missing."),
    };
  }

  const content = await readFile(absPath, "utf8");

  for (const childId of REQUIRED_CHILD_IDS) {
    if (!content.includes(childId)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: registryPath,
        line: 1,
        severity: "fatal",
        message: `Required child capability "${childId}" is not registered in mouse-click registry.`,
      });
    }
  }

  for (const forbiddenId of FORBIDDEN_CHILD_IDS) {
    if (content.includes(forbiddenId)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: registryPath,
        line: 1,
        severity: "fatal",
        message: `Forbidden legacy child capability "${forbiddenId}" found in mouse-click registry. Physical delete required.`,
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "registry-children",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Click registry contains exactly the 3 atomic browser-viewport child capabilities."
        : `Mouse Click registry check failed: ${findings.map((f) => f.message).join("; ")}`,
    ),
  };
}

// ─── 2. Fixed button/clickCount check ────────────────────────────────────────

async function checkFixedButtonClickCount(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const childFiles = [
    `${MOUSE_CLICK_PRODUCTION_ROOT}/children/left-click-browser-viewport-once.ts`,
    `${MOUSE_CLICK_PRODUCTION_ROOT}/children/double-left-click-browser-viewport.ts`,
    `${MOUSE_CLICK_PRODUCTION_ROOT}/children/right-click-browser-viewport-once.ts`,
    `${MOUSE_CLICK_PRODUCTION_ROOT}/shared/constants.ts`,
  ];

  for (const filePath of childFiles) {
    const absPath = pathFromRepoRoot(filePath);
    if (!(await fileExists(absPath))) {
      findings.push({
        lawId: LAW_IDS.PROOF,
        file: filePath,
        line: 1,
        severity: "fatal",
        message: `Required mouse-click file "${filePath}" is missing.`,
      });
    }
  }

  const constantsPath = pathFromRepoRoot(`${MOUSE_CLICK_PRODUCTION_ROOT}/shared/constants.ts`);
  if (await fileExists(constantsPath)) {
    const content = await readFile(constantsPath, "utf8");
    if (!content.includes("MOUSE_CLICK_BUTTON_MAP") || !content.includes("MOUSE_CLICK_COUNT_MAP")) {
      findings.push({
        lawId: LAW_IDS.PROOF,
        file: `${MOUSE_CLICK_PRODUCTION_ROOT}/shared/constants.ts`,
        line: 1,
        severity: "fatal",
        message: "constants.ts must define MOUSE_CLICK_BUTTON_MAP and MOUSE_CLICK_COUNT_MAP to fix button/clickCount per child.",
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "fixed-button-clickcount",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Click children and constants correctly fix button/clickCount per child capability."
        : `Fixed button/clickCount check failed: ${findings.map((f) => f.message).join("; ")}`,
    ),
  };
}

// ─── 3. Forbidden fields / schema pollution check ────────────────────────────

async function checkForbiddenFields(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const absRoot = pathFromRepoRoot(MOUSE_CLICK_PRODUCTION_ROOT);

  if (!(await fileExists(absRoot))) {
    return {
      findings: [],
      phase: createPhase("forbidden-fields", "ENFORCEMENT MISS", false, "mouse-click root directory not found."),
    };
  }

  const files = await listFilesRecursive(absRoot, { extensions: [".ts"] });

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    for (const field of FORBIDDEN_FIELDS) {
      if (content.includes(field)) {
        const relPath = filePath.replace(`${pathFromRepoRoot(".")}${"/"}`, "");
        findings.push({
          lawId: LAW_IDS.PROOF,
          file: relPath,
          line: 1,
          severity: "fatal",
          message: `Forbidden field or pattern "${field}" found in mouse-click production source. Physical removal required.`,
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
        ? "No forbidden binding/map/PAV/business-semantic fields in mouse-click production source."
        : `Forbidden field violations found: ${findings.length} occurrence(s).`,
    ),
  };
}

// ─── 4. Primitive execution check ────────────────────────────────────────────

async function checkPrimitiveExecution(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const portPath = `${MOUSE_CLICK_PRODUCTION_ROOT}/ports/mouse-click-primitive-port.ts`;
  const executorPath = `${MOUSE_CLICK_PRODUCTION_ROOT}/runtime/execute-click.ts`;
  const findings: Finding[] = [];

  for (const filePath of [portPath, executorPath]) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: filePath,
        line: 1,
        severity: "fatal",
        message: `Required mouse-click runtime file "${filePath}" is missing.`,
      });
    }
  }

  const portContent = await fileExists(pathFromRepoRoot(portPath))
    ? await readFile(pathFromRepoRoot(portPath), "utf8")
    : "";

  if (portContent && !portContent.includes("button: \"left\" | \"right\"")) {
    findings.push({
      lawId: LAW_IDS.PROOF,
      file: portPath,
      line: 1,
      severity: "fatal",
      message: "MouseClickPrimitivePort must declare button as fixed by child, not as optional parameter from external input.",
    });
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "primitive-execution",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Click primitive port and executor exist with correct button/clickCount contracts."
        : `Primitive execution check failed: ${findings.map((f) => f.message).join("; ")}`,
    ),
  };
}

// ─── 5. MuscleMemory atomic click exposure check ─────────────────────────────

async function checkMuscleMemory(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const catalogPath = "src/muscle-memory/generated-catalog.json";
  const absPath = pathFromRepoRoot(catalogPath);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: catalogPath,
      line: 1,
      severity: "fatal",
      message: "MuscleMemory generated catalog not found.",
    });
    return {
      findings,
      phase: createPhase("muscle-memory", "ENFORCEMENT MISS", false, "MuscleMemory catalog missing."),
    };
  }

  const content = await readFile(absPath, "utf8");

  const REQUIRED_AI_ACTIONS = [
    "LEFT_CLICK_GRID_CELL_ONCE",
    "DOUBLE_LEFT_CLICK_GRID_CELL",
    "RIGHT_CLICK_GRID_CELL_ONCE",
  ];

  const FORBIDDEN_ACTION_CODES = [
    "CLICK_BROWSER_COORDINATE",
    "CLICK_CELL",
  ];

  for (const actionCode of REQUIRED_AI_ACTIONS) {
    if (!content.includes(actionCode)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: catalogPath,
        line: 1,
        severity: "fatal",
        message: `Required AI-visible click action "${actionCode}" not found in MuscleMemory catalog.`,
      });
    }
  }

  // Check forbidden action codes are absent from catalog
  for (const actionCode of FORBIDDEN_ACTION_CODES) {
    if (content.includes(`"actionCode": "${actionCode}"`)) {
      findings.push({
        lawId: LAW_IDS.STRUCTURE,
        file: catalogPath,
        line: 1,
        severity: "fatal",
        message: `Forbidden action "${actionCode}" must not exist in the capability registry.`,
      });
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "muscle-memory",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "MuscleMemory exposes exactly the 3 atomic gridCell click actions and no legacy click actions."
        : `MuscleMemory check failed: ${findings.map((f) => f.message).join("; ")}`,
    ),
  };
}

// ─── 6. File count check ──────────────────────────────────────────────────────

async function checkFileCount(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absRoot = pathFromRepoRoot(MOUSE_CLICK_PRODUCTION_ROOT);
  const findings: Finding[] = [];

  if (!(await fileExists(absRoot))) {
    return {
      findings: [],
      phase: createPhase("file-count", "ENFORCEMENT MISS", false, "mouse-click root directory not found."),
    };
  }

  const files = await listFilesRecursive(absRoot, { extensions: [".ts"] });
  const count = files.length;

  if (count > MAX_PRODUCTION_FILE_COUNT) {
    findings.push({
      lawId: LAW_IDS.PROOF,
      file: MOUSE_CLICK_PRODUCTION_ROOT,
      line: 1,
      severity: "fatal",
      message: `Mouse Click production file count is ${count}, exceeding the max of ${MAX_PRODUCTION_FILE_COUNT}. Merge files to maintain simplicity.`,
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
        ? `Mouse Click production file count is ${count} (≤ ${MAX_PRODUCTION_FILE_COUNT}).`
        : `Mouse Click production has ${count} files, exceeding max ${MAX_PRODUCTION_FILE_COUNT}.`,
    ),
  };
}

// ─── Law baseline check ───────────────────────────────────────────────────────

async function checkLawBaseline(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const absPath = pathFromRepoRoot(MOUSE_CLICK_LAW_FILE);
  const findings: Finding[] = [];

  if (!(await fileExists(absPath))) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: MOUSE_CLICK_LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Mouse Click law file not found.",
    });
    return {
      findings,
      phase: createPhase("law-baseline", "LAW GAP", false, "Mouse Click law file missing."),
    };
  }

  const content = await readFile(absPath, "utf8");

  if (!content.includes("left-click-browser-viewport-once")) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: MOUSE_CLICK_LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Law file must explicitly enumerate left-click-browser-viewport-once as an active child.",
    });
  }

  if (!content.includes("double-left-click-browser-viewport")) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: MOUSE_CLICK_LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Law file must explicitly enumerate double-left-click-browser-viewport as an active child.",
    });
  }

  if (!content.includes("right-click-browser-viewport-once")) {
    findings.push({
      lawId: LAW_IDS.STRUCTURE,
      file: MOUSE_CLICK_LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Law file must explicitly enumerate right-click-browser-viewport-once as an active child.",
    });
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "law-baseline",
      passed ? "PASS" : "LAW GAP",
      passed,
      passed
        ? "Mouse Click law enumerates all three atomic child capabilities."
        : `Mouse Click law baseline check failed: ${findings.map((f) => f.message).join("; ")}`,
    ),
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export {
  checkLawBaseline,
  checkRegistryChildren,
  checkFixedButtonClickCount,
  checkForbiddenFields,
  checkPrimitiveExecution,
  checkMuscleMemory,
  checkFileCount,
};
