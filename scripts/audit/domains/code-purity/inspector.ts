// Code Purity Inspector — full ts-morph AST enforcement.
// ZERO regex on file text. Every check is AST-level, symbol-level, or anti-escape-level.
// Severity: HARD = CI-FULL instant FAIL. WARN = logged but non-blocking.
//
// Checks:
//   CP-AST-001  AnyKeyword in type positions anywhere in src/
//   CP-AST-002  @ts-ignore / @ts-expect-error suppression directives
//   CP-AST-003  eslint-disable suppression directives
//   CP-AST-004  console.* direct call expressions in src/
//   CP-AST-005  console alias / destructure / method-ref binding (escape attempt)
//   CP-AST-006  ImportDeclaration moduleSpecifier references retired capability roots
//   CP-FILE-001 Module directory file count exceeds configured limit

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";
import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { CODE_PURITY_CONFIG } from "./config.js";
import { ALLOWED_ARCHIVE_PATH_PATTERNS, RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES } from "./forbidden-surfaces.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PuritySeverity = "HARD" | "WARN";

export type PurityFinding = {
  rule: string;
  severity: PuritySeverity;
  file: string;
  line: number;
  message: string;
};

export type CodePurityInspectorResult = {
  findings: PurityFinding[];
  hardFails: number;
  warns: number;
  fileCountFails: number;
  pass: boolean;
};

// ─── Scope helpers ────────────────────────────────────────────────────────────

function rel(sf: SourceFile): string {
  return toRepoRelativePath(sf.getFilePath());
}

function isArchivePath(r: string): boolean {
  return ALLOWED_ARCHIVE_PATH_PATTERNS.some((p) => r.includes(p));
}

function isSrcScope(r: string): boolean {
  if (!CODE_PURITY_CONFIG.purityScanDirs.some((d) => r.startsWith(d))) return false;
  if (isArchivePath(r)) return false;
  if (r.endsWith(".d.ts")) return false;
  return true;
}

function isRetiredScanScope(r: string): boolean {
  if (!isSrcScope(r)) return false;
  if (CODE_PURITY_CONFIG.retiredScanExcludedPrefixes.some((p) => r.startsWith(p))) return false;
  if (RETIRED_SURFACE_SCAN_EXCLUDED_PREFIXES.some((p) => r.startsWith(p))) return false;
  return true;
}

function isSrcOnly(r: string): boolean {
  return r.startsWith("src/") && !isArchivePath(r) && !r.endsWith(".d.ts");
}

function countFilesInDir(relDir: string): number {
  const dir = join(pathFromRepoRoot("."), relDir);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.(ts|js|mjs|json)$/.test(d.name))
    .length;
}

// ─── Comment trivia scanner ───────────────────────────────────────────────────
// Scans every UNIQUE trivia position in a source file exactly once.
// This avoids false duplicates from forEachDescendant visiting children that share
// the same leading trivia as their parent.

function scanCommentTrivia(
  sf: SourceFile,
  matcher: (commentText: string) => boolean,
): Array<{ line: number; text: string }> {
  const results: Array<{ line: number; text: string }> = [];
  const seenTriviaStarts = new Set<number>();

  sf.forEachDescendant((node) => {
    const fullStart = node.getFullStart();
    if (seenTriviaStarts.has(fullStart)) return;
    seenTriviaStarts.add(fullStart);

    const nodeStart = node.getStart();
    if (nodeStart <= fullStart) return;

    const trivia = sf.getFullText().slice(fullStart, nodeStart);
    if (!matcher(trivia)) return;

    // Find which line the comment starts on
    const lineNum = sf.getLineAndColumnAtPos(fullStart).line;
    results.push({ line: lineNum, text: trivia.trim().slice(0, 120) });
  });

  return results;
}

// ─── CP-AST-001: any keyword in type positions ────────────────────────────────

function checkAnyKeyword(project: Project): PurityFinding[] {
  const findings: PurityFinding[] = [];

  for (const sf of project.getSourceFiles()) {
    const r = rel(sf);
    if (!isSrcOnly(r)) continue;

    sf.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.AnyKeyword) {
        findings.push({
          rule: "CP-AST-001",
          severity: "HARD",
          file: r,
          line: node.getStartLineNumber(),
          message: "any type — replace with an explicit typed contract (all forms: : any, as any, Array<any>, generic <any> all caught at AST level)",
        });
      }
    });
  }

  return findings;
}

// ─── CP-AST-002: @ts-ignore / @ts-expect-error ────────────────────────────────

// Matches ONLY actual TypeScript suppression directives, not docs mentioning them.
function isActualTsSuppressionDirective(triviaText: string): boolean {
  const lines = triviaText.split("\n");
  return lines.some((line) => {
    const stripped = line.replace(/^\s*\/\//, "").replace(/^\s*\/\*/, "").trim();
    return stripped.startsWith("@ts-ignore") || stripped.startsWith("@ts-expect-error");
  });
}

function checkTsSuppressions(project: Project): PurityFinding[] {
  const findings: PurityFinding[] = [];

  for (const sf of project.getSourceFiles()) {
    const r = rel(sf);
    if (!isSrcScope(r)) continue;

    for (const match of scanCommentTrivia(sf, isActualTsSuppressionDirective)) {
      findings.push({
        rule: "CP-AST-002",
        severity: "HARD",
        file: r,
        line: match.line,
        message: `TypeScript suppression directive — fix the type error instead: ${match.text}`,
      });
    }
  }

  return findings;
}

// ─── CP-AST-003: eslint-disable ───────────────────────────────────────────────

// Matches ONLY actual ESLint suppression directive comments.
// Rejects documentation comments that happen to mention "eslint-disable" as text.
// Real directives: `// eslint-disable`, `// eslint-disable-next-line`, `/* eslint-disable */`
function isActualEslintDirective(triviaText: string): boolean {
  // Split into individual comment segments and check each
  const lines = triviaText.split("\n");
  return lines.some((line) => {
    const stripped = line.replace(/^\s*\/\//, "").replace(/^\s*\/\*/, "").trim();
    return stripped.startsWith("eslint-disable");
  });
}

function checkEslintDisable(project: Project): PurityFinding[] {
  const findings: PurityFinding[] = [];

  for (const sf of project.getSourceFiles()) {
    const r = rel(sf);
    if (!isSrcScope(r)) continue;

    for (const match of scanCommentTrivia(sf, isActualEslintDirective)) {
      findings.push({
        rule: "CP-AST-003",
        severity: "HARD",
        file: r,
        line: match.line,
        message: `ESLint suppression directive — fix the lint issue instead: ${match.text}`,
      });
    }
  }

  return findings;
}

// ─── CP-AST-004 + CP-AST-005: console.* calls + alias escape detection ────────
//
// CP-AST-005 catches the escape attempts FIRST, then CP-AST-004 catches the calls.
// Both use the SAME two-pass per-file scan so aliases discovered in pass-1 are
// flagged by calls found in pass-2.

function checkConsoleAndAliases(project: Project): PurityFinding[] {
  const findings: PurityFinding[] = [];

  for (const sf of project.getSourceFiles()) {
    const r = rel(sf);
    if (!isSrcOnly(r)) continue;
    // Allow the one whitelisted sink file
    if (CODE_PURITY_CONFIG.purityScanDirs && r.includes("sinks.ts")) continue;

    // ── Pass 1: find alias bindings ──────────────────────────────────────────
    const consoleAliases = new Set<string>(["console"]);

    sf.forEachDescendant((node) => {
      if (!Node.isVariableDeclaration(node)) return;
      const init = node.getInitializer();
      if (!init) return;

      // const x = console
      if (Node.isIdentifier(init) && init.getText() === "console") {
        const nameNode = node.getNameNode();
        if (Node.isIdentifier(nameNode)) {
          consoleAliases.add(nameNode.getText());
          findings.push({
            rule: "CP-AST-005",
            severity: "HARD",
            file: r,
            line: node.getStartLineNumber(),
            message: `console alias binding \`${nameNode.getText()} = console\` — alias escape attempt, use runtimeLogger`,
          });
        }
        return;
      }

      // const { log, warn } = console
      if (
        Node.isObjectBindingPattern(node.getNameNode()) &&
        Node.isIdentifier(init) &&
        init.getText() === "console"
      ) {
        for (const elem of node.getNameNode().asKindOrThrow(SyntaxKind.ObjectBindingPattern).getElements()) {
          consoleAliases.add(elem.getName());
          findings.push({
            rule: "CP-AST-005",
            severity: "HARD",
            file: r,
            line: node.getStartLineNumber(),
            message: `console destructure alias \`{ ${elem.getName()} } = console\` — alias escape attempt`,
          });
        }
        return;
      }

      // const log = console.log
      if (Node.isPropertyAccessExpression(init)) {
        const obj = init.getExpression();
        if (Node.isIdentifier(obj) && obj.getText() === "console") {
          const nameNode = node.getNameNode();
          if (Node.isIdentifier(nameNode)) {
            consoleAliases.add(nameNode.getText());
            findings.push({
              rule: "CP-AST-005",
              severity: "HARD",
              file: r,
              line: node.getStartLineNumber(),
              message: `console method alias \`${nameNode.getText()} = console.${init.getName()}\` — alias escape attempt`,
            });
          }
        }
      }
    });

    // ── Pass 2: find call expressions using console or any alias ─────────────
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      const obj = expr.getExpression();
      if (!Node.isIdentifier(obj)) return;
      if (!consoleAliases.has(obj.getText())) return;

      findings.push({
        rule: "CP-AST-004",
        severity: "HARD",
        file: r,
        line: node.getStartLineNumber(),
        message: `\`${obj.getText()}.${expr.getName()}()\` call — production code must use runtimeLogger.emit() instead`,
      });
    });
  }

  return findings;
}

// ─── CP-AST-006: ImportDeclaration to retired capability roots ────────────────

function checkRetiredImports(project: Project): PurityFinding[] {
  const findings: PurityFinding[] = [];
  const retiredRoots = CODE_PURITY_CONFIG.retiredCapabilityRoots;

  for (const sf of project.getSourceFiles()) {
    const r = rel(sf);
    if (!isRetiredScanScope(r)) continue;

    for (const importDecl of sf.getImportDeclarations()) {
      const spec = importDecl.getModuleSpecifierValue();
      for (const retiredRoot of retiredRoots) {
        // Strip "src/" prefix so relative import paths like "../../capabilities/page-state" also match
        const normalized = retiredRoot.replace(/^src\//, "");
        if (spec.includes(normalized)) {
          findings.push({
            rule: "CP-AST-006",
            severity: "HARD",
            file: r,
            line: importDecl.getStartLineNumber(),
            message: `Import from retired capability root: '${spec}' — this system is permanently retired`,
          });
        }
      }
    }
  }

  return findings;
}

// ─── CP-FILE-001: Module file count limits ────────────────────────────────────

function checkFileCountLimits(): PurityFinding[] {
  const findings: PurityFinding[] = [];

  for (const [moduleDir, limit] of Object.entries(CODE_PURITY_CONFIG.moduleFileLimits)) {
    const count = countFilesInDir(moduleDir);
    if (count > limit) {
      findings.push({
        rule: "CP-FILE-001",
        severity: "HARD",
        file: moduleDir,
        line: 0,
        message: `${moduleDir}: ${count} files — exceeds limit of ${limit}. Delete dead files before adding new ones.`,
      });
    }
  }

  // Retired directories must not exist at all
  for (const retiredRoot of CODE_PURITY_CONFIG.retiredCapabilityRoots) {
    if (existsSync(join(pathFromRepoRoot("."), retiredRoot))) {
      findings.push({
        rule: "CP-FILE-001",
        severity: "HARD",
        file: retiredRoot,
        line: 0,
        message: `Retired capability directory still exists on disk: ${retiredRoot}`,
      });
    }
  }

  return findings;
}

// ─── Inspector entry point ────────────────────────────────────────────────────

export function runCodePurityInspector(): CodePurityInspectorResult {
  const project = getAuditProject();

  // Load all src/ TypeScript source files into the project
  project.addSourceFilesFromTsConfig(pathFromRepoRoot("tsconfig.json"));

  const rawFindings: PurityFinding[] = [
    ...checkAnyKeyword(project),
    ...checkTsSuppressions(project),
    ...checkEslintDisable(project),
    ...checkConsoleAndAliases(project),
    ...checkRetiredImports(project),
    ...checkFileCountLimits(),
  ];

  // Deduplicate: same rule + file + line = one finding
  const seen = new Set<string>();
  const findings = rawFindings.filter((f) => {
    const key = `${f.rule}:${f.file}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const hardFails = findings.filter((f) => f.severity === "HARD").length;
  const warns = findings.filter((f) => f.severity === "WARN").length;
  const fileCountFails = findings.filter((f) => f.rule === "CP-FILE-001").length;

  return { findings, hardFails, warns, fileCountFails, pass: hardFails === 0 };
}
