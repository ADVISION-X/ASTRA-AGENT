import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { QUALITY_KERNEL_LIMITS } from "./config.js";
import {
  FORBIDDEN_ACTIVE_PATTERNS_HARD,
  FORBIDDEN_ACTIVE_PATTERNS_SOFT,
  ALLOWED_ARCHIVE_PATH_PATTERNS,
  RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES,
} from "./forbidden-surfaces.js";
import { checkFileCounts } from "./file-counts.js";

const repoRoot = process.cwd();

// ----------- helpers -----------

const readText = (filePath: string): string => {
  try { return readFileSync(filePath, "utf-8"); }
  catch { return ""; }
};

const isArchivedPath = (relPath: string): boolean =>
  ALLOWED_ARCHIVE_PATH_PATTERNS.some((p) => relPath.includes(p));

const isExcludedFromRetiredScan = (relPath: string): boolean =>
  RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES.some((p) => relPath.startsWith(p));

const isCommentLine = (line: string): boolean => {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

const walkFiles = (dir: string, acc: string[] = []): string[] => {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
};

const walkTsFiles = (dir: string): string[] =>
  walkFiles(dir).filter((f) => /\.(ts|tsx)$/.test(f));

// ----------- check 1: Code Purity (hard red lines only) -----------

const CODE_PURITY_CHECKS: Array<{ label: string; test: (line: string) => boolean }> = [
  { label: "ts-ignore forbidden", test: (l) => l.includes("@ts-ignore") },
  { label: "eslint-disable forbidden", test: (l) => l.includes("eslint-disable") },
  { label: "console.log in production path", test: (l) => /\bconsole\.log\b/.test(l) },
  { label: "TODO/FIXME in production path", test: (l) => /\b(TODO|FIXME)\b/.test(l) },
  { label: ": any type forbidden", test: (l) => /: any\b|as any\b/.test(l) },
];

const PRODUCTION_PATHS = ["src", "scripts/audit"];
const TEST_LIKE_NAMES = /\.(test|spec|mock|fake|demo|fixture)\./;

type PurityFinding = { file: string; line: number; pattern: string };

const runCodePurityCheck = (): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  for (const baseDir of PRODUCTION_PATHS) {
    const files = walkTsFiles(join(repoRoot, baseDir));
    for (const filePath of files) {
      const relPath = relative(repoRoot, filePath);
      if (isArchivedPath(relPath)) continue;
      if (TEST_LIKE_NAMES.test(filePath)) continue;
      const lines = readText(filePath).split("\n");
      lines.forEach((line, idx) => {
        if (isCommentLine(line)) return;
        for (const check of CODE_PURITY_CHECKS) {
          if (check.test(line)) {
            findings.push({ file: relPath, line: idx + 1, pattern: check.label });
          }
        }
      });
    }
  }
  return findings;
};

// ----------- check 2: Retired Surface Anti-Regression -----------

type RetiredSurfaceFinding = { file: string; line: number; pattern: string; severity: "hard" | "soft" };

const ACTIVE_SCAN_DIRS = [
  join(repoRoot, "src"),
  join(repoRoot, "scripts/audit/domains"),
  join(repoRoot, "scripts/audit/core"),
  join(repoRoot, "scripts/startup"),
];

const scanForPatterns = (
  files: string[],
  patterns: readonly string[],
  severity: "hard" | "soft",
): RetiredSurfaceFinding[] => {
  const findings: RetiredSurfaceFinding[] = [];
  for (const filePath of files) {
    const relPath = relative(repoRoot, filePath);
    if (isArchivedPath(relPath)) continue;
    if (isExcludedFromRetiredScan(relPath)) continue;
    const lines = readText(filePath).split("\n");
    for (const forbiddenPattern of patterns) {
      lines.forEach((line, idx) => {
        if (isCommentLine(line)) return;
        if (line.includes(forbiddenPattern)) {
          findings.push({ file: relPath, line: idx + 1, pattern: forbiddenPattern, severity });
        }
      });
    }
  }
  return findings;
};

const runRetiredSurfaceCheck = (): RetiredSurfaceFinding[] => {
  const findings: RetiredSurfaceFinding[] = [];
  for (const dir of ACTIVE_SCAN_DIRS) {
    const files = walkFiles(dir).filter((f) => /\.(ts|tsx|js|mjs|json)$/.test(f));
    findings.push(...scanForPatterns(files, FORBIDDEN_ACTIVE_PATTERNS_HARD, "hard"));
    findings.push(...scanForPatterns(files, FORBIDDEN_ACTIVE_PATTERNS_SOFT, "soft"));
  }
  return findings;
};

// ----------- check 3: MuscleMemory Guard -----------

type MuscleMemoryFinding = { kind: "missing-required" | "forbidden-present"; actionCode: string };

const runMuscleMemoryCheck = (): MuscleMemoryFinding[] => {
  const catalogPath = join(repoRoot, "src/muscle-memory/generated-catalog.json");
  const findings: MuscleMemoryFinding[] = [];
  if (!existsSync(catalogPath)) {
    findings.push({ kind: "missing-required", actionCode: "(catalog file missing)" });
    return findings;
  }
  let catalog: { entries?: Array<{ actionCode?: string }> };
  try { catalog = JSON.parse(readText(catalogPath)); }
  catch { findings.push({ kind: "missing-required", actionCode: "(catalog parse error)" }); return findings; }

  const presentCodes = new Set((catalog.entries ?? []).map((e) => e.actionCode ?? ""));

  for (const required of QUALITY_KERNEL_LIMITS.requiredMuscleMemoryActionCodes) {
    if (!presentCodes.has(required)) {
      findings.push({ kind: "missing-required", actionCode: required });
    }
  }
  for (const forbidden of QUALITY_KERNEL_LIMITS.forbiddenMuscleMemoryActionCodes) {
    if (presentCodes.has(forbidden)) {
      findings.push({ kind: "forbidden-present", actionCode: forbidden });
    }
  }
  const text = readText(catalogPath);
  if (text.includes("product-presence-judgment")) {
    findings.push({ kind: "forbidden-present", actionCode: "product-presence-judgment (childCapabilityId)" });
  }
  return findings;
};

// ----------- check 4: CI Plan Guard -----------

type CiPlanFinding = { pattern: string };

const runCiPlanCheck = (): CiPlanFinding[] => {
  const ciPlanPath = join(repoRoot, "scripts/audit/core/ci-full-plan.ts");
  const text = readText(ciPlanPath);
  const findings: CiPlanFinding[] = [];
  for (const forbidden of QUALITY_KERNEL_LIMITS.forbiddenCiPlanStrings) {
    if (text.includes(forbidden)) {
      findings.push({ pattern: `ci-full-plan.ts contains forbidden: "${forbidden}"` });
    }
  }
  return findings;
};

// ----------- main export -----------

export type InspectorResult = {
  pass: boolean;
  codePurityFindings: PurityFinding[];
  hardRetiredSurfaceFindings: RetiredSurfaceFinding[];
  softRetiredSurfaceFindings: RetiredSurfaceFinding[];
  muscleMemoryFindings: MuscleMemoryFinding[];
  ciPlanFindings: CiPlanFinding[];
  fileCountFindings: ReturnType<typeof checkFileCounts>;
};

export const runQualityKernelInspector = (): InspectorResult => {
  const codePurityFindings = runCodePurityCheck();
  const retiredSurfaceFindings = runRetiredSurfaceCheck();
  const hardRetiredSurfaceFindings = retiredSurfaceFindings.filter((f) => f.severity === "hard");
  const softRetiredSurfaceFindings = retiredSurfaceFindings.filter((f) => f.severity === "soft");
  const muscleMemoryFindings = runMuscleMemoryCheck();
  const ciPlanFindings = runCiPlanCheck();
  const fileCountFindings = checkFileCounts();

  const fileCountFails = fileCountFindings.filter((f) => f.status === "fail" || f.status === "retired-exists");

  // PASS requires: no HARD retired surface, no muscle-memory issues, no CI plan issues, no file count FAIL
  const pass =
    hardRetiredSurfaceFindings.length === 0 &&
    muscleMemoryFindings.length === 0 &&
    ciPlanFindings.length === 0 &&
    fileCountFails.length === 0;

  return { pass, codePurityFindings, hardRetiredSurfaceFindings, softRetiredSurfaceFindings, muscleMemoryFindings, ciPlanFindings, fileCountFindings };
};
