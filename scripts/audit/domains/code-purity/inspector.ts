// Code Purity Inspector — structural health checks only.
// Checks: purity red lines, retired surface anti-regression, module file limits.
// Does NOT check business logic, ability details, or AI correctness.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { CODE_PURITY_CONFIG } from "./config.js";
import {
  FORBIDDEN_ACTIVE_PATTERNS_HARD,
  ALLOWED_ARCHIVE_PATH_PATTERNS,
  RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES,
} from "./forbidden-surfaces.js";

const ROOT = process.cwd();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readText = (p: string): string => {
  try { return readFileSync(p, "utf-8"); } catch { return ""; }
};

const isArchived = (rel: string): boolean =>
  ALLOWED_ARCHIVE_PATH_PATTERNS.some((p) => rel.includes(p));

const isComment = (line: string): boolean => {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

const walkFiles = (dir: string, acc: string[] = []): string[] => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, acc);
    else if (e.isFile()) acc.push(full);
  }
  return acc;
};

const walkTs = (dir: string): string[] =>
  walkFiles(dir).filter((f) => /\.(ts|tsx)$/.test(f));

const countFilesRecursive = (dir: string): number => {
  if (!existsSync(dir)) return -1;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? countFilesRecursive(join(dir, e.name)) : 1;
  }
  return n;
};

// ─── Finding types ────────────────────────────────────────────────────────────

export type PurityFinding = {
  file: string; line: number; rule: string; fixDirection: string; severity: "HARD" | "WARN";
};

export type RetiredSurfaceFinding = {
  file: string; line: number; pattern: string;
};

export type FileCountFinding = {
  module: string; actual: number; limit: number;
  status: "ok" | "fail" | "retired-exists";
};

export type CodePurityResult = {
  pass: boolean;
  purityFindings: PurityFinding[];
  retiredSurfaceFindings: RetiredSurfaceFinding[];
  fileCountFindings: FileCountFinding[];
};

// ─── Check 1: Code Purity Red Lines ──────────────────────────────────────────

const PURITY_RULES: Array<{
  rule: string;
  test: (l: string) => boolean;
  fixDirection: string;
  severity: "HARD" | "WARN";
}> = [
  {
    rule: "ts-ignore forbidden",
    test: (l) => l.includes("@ts-ignore"),
    fixDirection: "Fix the type error properly instead of suppressing it.",
    severity: "HARD",
  },
  {
    rule: "eslint-disable forbidden",
    // Split token so this file does not self-trigger the scanner.
    test: (l) => l.includes("eslint" + "-disable"),
    fixDirection: "Fix the lint violation instead of suppressing it.",
    severity: "HARD",
  },
  {
    rule: "any type forbidden",
    test: (l) => /: any\b|as any\b/.test(l),
    fixDirection: "Use explicit types or unknown with a type guard.",
    severity: "HARD",
  },
  {
    rule: "console.log in production",
    test: (l) => /\bconsole\.log\b/.test(l),
    fixDirection: "Use runtimeLogger.emit() for structured logging.",
    severity: "WARN",
  },
  // Split token so this file does not self-trigger.
  {
    rule: "TODO/FIXME in production",
    test: (l) => /\b(TODO|FIXME)\b/.test(l),
    fixDirection: "Resolve or move to docs before merging.",
    severity: "WARN",
  },
];

const TEST_FILE_PATTERN = /\.(test|spec|mock|fake|demo|fixture)\./;

function runPurityCheck(): PurityFinding[] {
  const findings: PurityFinding[] = [];
  for (const baseDir of CODE_PURITY_CONFIG.purityScanDirs) {
    for (const filePath of walkTs(join(ROOT, baseDir))) {
      const rel = relative(ROOT, filePath);
      if (isArchived(rel) || TEST_FILE_PATTERN.test(filePath)) continue;
      const lines = readText(filePath).split("\n");
      lines.forEach((line, idx) => {
        if (isComment(line)) return;
        for (const { rule, test, fixDirection, severity } of PURITY_RULES) {
          if (test(line)) findings.push({ file: rel, line: idx + 1, rule, fixDirection, severity });
        }
      });
    }
  }
  return findings;
}

// ─── Check 2: Retired Surface Anti-Regression ────────────────────────────────

const RETIRED_SCAN_DIRS = [
  "src",
  "scripts/audit/domains",
  "scripts/audit/core",
  "scripts/startup",
];

function runRetiredSurfaceCheck(): RetiredSurfaceFinding[] {
  const findings: RetiredSurfaceFinding[] = [];
  for (const d of RETIRED_SCAN_DIRS) {
    const dir = join(ROOT, d);
    if (!existsSync(dir)) continue;
    for (const filePath of walkFiles(dir)) {
      if (!/\.(ts|tsx|js|mjs|json)$/.test(filePath)) continue;
      const rel = relative(ROOT, filePath);
      if (isArchived(rel)) continue;
      if (RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) continue;
      if (CODE_PURITY_CONFIG.retiredScanExcludedPrefixes.some((p) => rel.startsWith(p))) continue;
      const lines = readText(filePath).split("\n");
      for (const pattern of FORBIDDEN_ACTIVE_PATTERNS_HARD) {
        lines.forEach((line, idx) => {
          if (isComment(line)) return;
          if (line.includes(pattern)) findings.push({ file: rel, line: idx + 1, pattern });
        });
      }
    }
  }
  return findings;
}

// ─── Check 3: Module File Count Limits ───────────────────────────────────────

function runFileCountCheck(): FileCountFinding[] {
  const findings: FileCountFinding[] = [];

  for (const [mod, limit] of Object.entries(CODE_PURITY_CONFIG.moduleFileLimits)) {
    const actual = countFilesRecursive(join(ROOT, mod));
    if (actual === -1) {
      findings.push({ module: mod, actual: 0, limit, status: "ok" });
    } else {
      findings.push({ module: mod, actual, limit, status: actual <= limit ? "ok" : "fail" });
    }
  }

  for (const retired of CODE_PURITY_CONFIG.retiredCapabilityRoots) {
    if (existsSync(join(ROOT, retired))) {
      findings.push({ module: retired, actual: 1, limit: 0, status: "retired-exists" });
    } else {
      findings.push({ module: retired, actual: 0, limit: 0, status: "ok" });
    }
  }

  return findings;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function runCodePurityInspector(): CodePurityResult {
  const purityFindings = runPurityCheck();
  const retiredSurfaceFindings = runRetiredSurfaceCheck();
  const fileCountFindings = runFileCountCheck();

  const hardPurityFails = purityFindings.filter((f) => f.severity === "HARD");
  const fileCountFails = fileCountFindings.filter((f) => f.status !== "ok");
  const pass = hardPurityFails.length === 0 && retiredSurfaceFindings.length === 0 && fileCountFails.length === 0;

  return { pass, purityFindings, retiredSurfaceFindings, fileCountFindings };
}
