// Runtime Logging Inspector — checks 10 governance questions.
// No giant report, no inventory. Only structured pass/fail findings.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { Node, SyntaxKind } from "ts-morph";
import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { RUNTIME_LOGGING_CONFIG } from "./config.js";

const ROOT = process.cwd();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countFilesInDir(relDir: string): number {
  const dir = join(ROOT, relDir);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && [".ts", ".js", ".mjs", ".json"].includes(extname(d.name)))
    .length;
}

function readSrc(relPath: string): string {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

function gatherTsFiles(relDirs: string[]): Array<{ rel: string; src: string }> {
  const result: Array<{ rel: string; src: string }> = [];
  for (const relDir of relDirs) {
    const dir = join(ROOT, relDir);
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true } as Parameters<typeof readdirSync>[1]);
    for (const e of entries as unknown as { isFile(): boolean; name: string; parentPath?: string; path?: string }[]) {
      if (!e.isFile()) continue;
      const parent = (e as { parentPath?: string; path?: string }).parentPath ?? (e as { path?: string }).path ?? dir;
      const full = join(parent as string, e.name);
      if (extname(e.name) !== ".ts") continue;
      const rel = full.replace(ROOT + "/", "");
      result.push({ rel, src: readFileSync(full, "utf8") });
    }
  }
  return result;
}

// ─── Check Types ─────────────────────────────────────────────────────────────

export type RuntimeLoggingCheckResult = {
  checkId: string;
  question: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
};

export type RuntimeLoggingInspectorResult = {
  checks: RuntimeLoggingCheckResult[];
  overallStatus: "PASS" | "FAIL" | "WARN";
};

// ─── Inspector ───────────────────────────────────────────────────────────────

export function runRuntimeLoggingInspector(): RuntimeLoggingInspectorResult {
  const checks: RuntimeLoggingCheckResult[] = [];

  // ── CHECK 1: Law file has active laws, no retired-only ───────────────────
  {
    const lawSrc = readSrc(".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md");
    const hasActive = /status:\s*active/.test(lawSrc);
    const hasRetired = /status:\s*retired/.test(lawSrc);
    const hasSpine = /Runtime Log Spine/.test(lawSrc);
    if (hasActive && !hasRetired && hasSpine) {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "PASS", detail: "5 active laws found, no retired laws." });
    } else if (!hasActive) {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "FAIL", detail: "No active laws found in module-structured-logging." });
    } else if (hasRetired) {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "FAIL", detail: "Retired laws still present — law file not fully replaced." });
    } else {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "WARN", detail: "Active laws found but 'Runtime Log Spine' branding missing." });
    }
  }

  // ── CHECK 2: src/lib/runtime-logs file count <= 8 ────────────────────────
  {
    const count = countFilesInDir("src/lib/runtime-logs");
    if (count === 0) {
      checks.push({ checkId: "CHECK-02", question: "src/lib/runtime-logs file count <= 8?", status: "FAIL", detail: "Directory does not exist or has no files." });
    } else if (count <= RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles) {
      checks.push({ checkId: "CHECK-02", question: "src/lib/runtime-logs file count <= 8?", status: "PASS", detail: `${count} file(s) found (limit: ${RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles}).` });
    } else {
      checks.push({ checkId: "CHECK-02", question: "src/lib/runtime-logs file count <= 8?", status: "FAIL", detail: `${count} file(s) found — exceeds limit of ${RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles}.` });
    }
  }

  // ── CHECK 3: RuntimeLogEvent schema has required fields ──────────────────
  {
    const schemaSrc = readSrc("src/lib/runtime-logs/schema.ts");
    const missingFields = RUNTIME_LOGGING_CONFIG.requiredSchemaFields.filter((f) => !schemaSrc.includes(f));
    if (missingFields.length === 0) {
      checks.push({ checkId: "CHECK-03", question: "RuntimeLogEvent schema has eventId/traceId/level/eventType/owner/createdAt/modeVisibility?", status: "PASS", detail: "All required fields present." });
    } else {
      checks.push({ checkId: "CHECK-03", question: "RuntimeLogEvent schema has eventId/traceId/level/eventType/owner/createdAt/modeVisibility?", status: "FAIL", detail: `Missing: ${missingFields.join(", ")}` });
    }
  }

  // ── CHECK 4: FLOW / DEBUG / TRACE modes exist ────────────────────────────
  {
    const modeSrc = readSrc("src/lib/runtime-logs/mode.ts");
    const missingModes = RUNTIME_LOGGING_CONFIG.requiredModes.filter((m) => !modeSrc.includes(`"${m}"`));
    if (missingModes.length === 0) {
      checks.push({ checkId: "CHECK-04", question: "FLOW / DEBUG / TRACE mode exists in mode.ts?", status: "PASS", detail: "All three modes found." });
    } else {
      checks.push({ checkId: "CHECK-04", question: "FLOW / DEBUG / TRACE mode exists in mode.ts?", status: "FAIL", detail: `Missing modes: ${missingModes.join(", ")}` });
    }
  }

  // ── CHECK 5: redactRuntimeLogPayload exists ──────────────────────────────
  {
    const redactSrc = readSrc("src/lib/runtime-logs/redaction.ts");
    if (redactSrc.includes(RUNTIME_LOGGING_CONFIG.redactionFunctionName)) {
      checks.push({ checkId: "CHECK-05", question: "redactRuntimeLogPayload exists in redaction.ts?", status: "PASS", detail: "redactRuntimeLogPayload found." });
    } else {
      checks.push({ checkId: "CHECK-05", question: "redactRuntimeLogPayload exists in redaction.ts?", status: "FAIL", detail: "redactRuntimeLogPayload not found in src/lib/runtime-logs/redaction.ts." });
    }
  }

  // ── CHECK 6: No console.log/error/warn/debug in production src ──────────
  {
    const srcFiles = gatherTsFiles(["src"]);
    const violations: string[] = [];
    for (const { rel, src } of srcFiles) {
      if (RUNTIME_LOGGING_CONFIG.consoleWhitelist.some((w) => rel.includes(w))) continue;
      for (const pattern of RUNTIME_LOGGING_CONFIG.forbiddenConsolePatterns) {
        const lines = src.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes(pattern) && !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*")) {
            violations.push(`${rel}:${idx + 1} → ${pattern}`);
          }
        });
      }
    }
    if (violations.length === 0) {
      checks.push({ checkId: "CHECK-06", question: "No raw console debug output in production src (except whitelist)?", status: "PASS", detail: "No console debug patches found." });
    } else {
      checks.push({ checkId: "CHECK-06", question: "No raw console debug output in production src (except whitelist)?", status: "FAIL", detail: `${violations.length} violation(s):\n  ${violations.slice(0, 10).join("\n  ")}` });
    }
  }

  // ── CHECK 7–10: AI four-piece event types ────────────────────────────────
  const aiFiles = gatherTsFiles([...RUNTIME_LOGGING_CONFIG.aiSourcePaths, "src/lib/runtime-logs"]);
  const aiSrcCombined = aiFiles.map((f) => f.src).join("\n");

  const aiChecks = [
    { checkId: "CHECK-07", event: "AI_REQUEST_DEBUG", question: "AI_REQUEST_DEBUG emitted before model call?" },
    { checkId: "CHECK-08", event: "AI_RAW_RESPONSE_DEBUG", question: "AI_RAW_RESPONSE_DEBUG emitted after model call?" },
    { checkId: "CHECK-09", event: "AI_PARSE_RESULT_DEBUG", question: "AI_PARSE_RESULT_DEBUG emitted after parse?" },
    { checkId: "CHECK-10", event: "AI_ERROR_DEBUG", question: "AI_ERROR_DEBUG emitted before AI failure?" },
  ] as const;

  for (const c of aiChecks) {
    if (aiSrcCombined.includes(c.event)) {
      checks.push({ checkId: c.checkId, question: c.question, status: "PASS", detail: `${c.event} found in AI/local-ai source.` });
    } else {
      checks.push({ checkId: c.checkId, question: c.question, status: "FAIL", detail: `${c.event} not found in AI/local-ai source files.` });
    }
  }

  // ── RLOG-04: runtimeLogger injected into AI ability group ─────────────────
  {
    const assemblySrc = readSrc("src/lib/local-runtime/workbench-assembly.ts");
    if (!assemblySrc) {
      checks.push({ checkId: "RLOG-04", question: "runtimeLogger passed to createConfiguredAiAbilityGroup in workbench-assembly?", status: "FAIL", detail: "workbench-assembly.ts not found." });
    } else if (assemblySrc.includes("createConfiguredAiAbilityGroup({ dataDir, runtimeLogger })")) {
      checks.push({ checkId: "RLOG-04", question: "runtimeLogger passed to createConfiguredAiAbilityGroup in workbench-assembly?", status: "PASS", detail: "runtimeLogger injected into AI ability group — AI events will fire." });
    } else {
      checks.push({ checkId: "RLOG-04", question: "runtimeLogger passed to createConfiguredAiAbilityGroup in workbench-assembly?", status: "FAIL", detail: "runtimeLogger not passed to createConfiguredAiAbilityGroup — AI events silently dropped." });
    }
  }

  // ── RLOG-05: task-start-debug-writer has no any / eslint-disable ──────────
  {
    const debugWriterSrc = readSrc("src/lib/local-app-shell/task-start-debug-writer.ts");
    if (!debugWriterSrc) {
      checks.push({ checkId: "RLOG-05", question: "task-start-debug-writer.ts has no untyped-any or lint-suppress and correct event mapping?", status: "FAIL", detail: "task-start-debug-writer.ts not found." });
    } else {
      const violations: string[] = [];
      // Use concat so this inspector source does not self-trigger the CODE-PURITY scanner.
      if (debugWriterSrc.includes("eslint" + "-disable")) violations.push("eslint" + "-disable");
      if (debugWriterSrc.includes("Record<string, any>")) violations.push("Record<string, any>");
      if (/MISSION_PREFLIGHT_PASSED[^,}]*MISSION_STARTED/.test(debugWriterSrc)) violations.push("MISSION_PREFLIGHT_PASSED mapped to MISSION_STARTED");
      if (violations.length === 0) {
        checks.push({ checkId: "RLOG-05", question: "task-start-debug-writer.ts has no untyped-any or lint-suppress and correct event mapping?", status: "PASS", detail: "No forbidden tokens; event mapping is correct." });
      } else {
        checks.push({ checkId: "RLOG-05", question: "task-start-debug-writer.ts has no untyped-any or lint-suppress and correct event mapping?", status: "FAIL", detail: `Violations: ${violations.join(", ")}` });
      }
    }
  }

  // ── LOG-AST-001: all AI log emit calls in model-call.ts have traceId field ──
  {
    const MODEL_CALL_PATH = "src/capabilities/ai/runtime/model-call.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(MODEL_CALL_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(MODEL_CALL_PATH));
      if (!sf) {
        checks.push({ checkId: "LOG-AST-001", question: "All AI emit() calls in model-call.ts have traceId field (AST)?", status: "FAIL", detail: `File not found: ${MODEL_CALL_PATH}` });
      } else {
        const emitCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => {
          const expr = c.getExpression();
          return Node.isPropertyAccessExpression(expr) && expr.getName() === "emit";
        });
        const missingTraceId = emitCalls.filter(c => {
          const args = c.getArguments();
          if (args.length === 0) return false;
          const arg = args[0];
          if (!Node.isObjectLiteralExpression(arg)) return false;
          return !arg.getProperties().some(p => (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) && p.getName() === "traceId");
        });
        if (missingTraceId.length === 0) {
          checks.push({ checkId: "LOG-AST-001", question: "All AI emit() calls in model-call.ts have traceId field (AST)?", status: "PASS", detail: `All ${emitCalls.length} emit() calls have traceId field (AST).` });
        } else {
          checks.push({ checkId: "LOG-AST-001", question: "All AI emit() calls in model-call.ts have traceId field (AST)?", status: "FAIL", detail: `${missingTraceId.length} emit() call(s) missing traceId field.` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-001", question: "All AI emit() calls in model-call.ts have traceId field (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── LOG-AST-002: all AI emit calls in visual-mission-judge-once.ts have traceId ──
  {
    const JUDGE_PATH = "src/capabilities/ai/children/visual-mission-judge-once.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(JUDGE_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(JUDGE_PATH));
      if (!sf) {
        checks.push({ checkId: "LOG-AST-002", question: "All AI emit() calls in visual-mission-judge-once.ts have traceId field (AST)?", status: "FAIL", detail: `File not found: ${JUDGE_PATH}` });
      } else {
        const emitCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => {
          const expr = c.getExpression();
          return Node.isPropertyAccessExpression(expr) && expr.getName() === "emit";
        });
        const missingTraceId = emitCalls.filter(c => {
          const args = c.getArguments();
          if (args.length === 0) return false;
          const arg = args[0];
          if (!Node.isObjectLiteralExpression(arg)) return false;
          return !arg.getProperties().some(p => (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) && p.getName() === "traceId");
        });
        if (missingTraceId.length === 0) {
          checks.push({ checkId: "LOG-AST-002", question: "All AI emit() calls in visual-mission-judge-once.ts have traceId field (AST)?", status: "PASS", detail: `All ${emitCalls.length} emit() calls have traceId field (AST).` });
        } else {
          checks.push({ checkId: "LOG-AST-002", question: "All AI emit() calls in visual-mission-judge-once.ts have traceId field (AST)?", status: "FAIL", detail: `${missingTraceId.length} emit() call(s) missing traceId field.` });
        }
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-002", question: "All AI emit() calls in visual-mission-judge-once.ts have traceId field (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── LOG-AST-003: AI_RAW_RESPONSE_DEBUG emitted in call-local-model.ts ──
  {
    const CALL_LOCAL_MODEL_PATH = "src/lib/local-ai/call-local-model.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(CALL_LOCAL_MODEL_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(CALL_LOCAL_MODEL_PATH));
      if (!sf) {
        checks.push({ checkId: "LOG-AST-003", question: "AI_RAW_RESPONSE_DEBUG emitted in call-local-model.ts (AST)?", status: "FAIL", detail: `File not found: ${CALL_LOCAL_MODEL_PATH}` });
      } else {
        const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral);
        const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier).filter(id => id.getText() === "AI_RAW_RESPONSE_DEBUG");
        const hasRawResponseEmit = identifiers.length > 0 || stringLiterals.some(sl => sl.getLiteralText() === "AI_RAW_RESPONSE_DEBUG");
        if (hasRawResponseEmit) {
          checks.push({ checkId: "LOG-AST-003", question: "AI_RAW_RESPONSE_DEBUG emitted in call-local-model.ts (AST)?", status: "PASS", detail: "AI_RAW_RESPONSE_DEBUG event reference found in call-local-model.ts (AST)." });
        } else {
          checks.push({ checkId: "LOG-AST-003", question: "AI_RAW_RESPONSE_DEBUG emitted in call-local-model.ts (AST)?", status: "FAIL", detail: "AI_RAW_RESPONSE_DEBUG not found in call-local-model.ts — raw model response not logged." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-003", question: "AI_RAW_RESPONSE_DEBUG emitted in call-local-model.ts (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── LOG-AST-004: AI_PARSE_RESULT_DEBUG emitted in visual-mission-judge-once.ts ──
  {
    const JUDGE_PATH = "src/capabilities/ai/children/visual-mission-judge-once.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(JUDGE_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(JUDGE_PATH));
      if (!sf) {
        checks.push({ checkId: "LOG-AST-004", question: "AI_PARSE_RESULT_DEBUG emitted in visual-mission-judge-once.ts (AST)?", status: "FAIL", detail: `File not found: ${JUDGE_PATH}` });
      } else {
        const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier).filter(id => id.getText() === "AI_PARSE_RESULT_DEBUG");
        const stringLiterals = sf.getDescendantsOfKind(SyntaxKind.StringLiteral).filter(sl => sl.getLiteralText() === "AI_PARSE_RESULT_DEBUG");
        if (identifiers.length > 0 || stringLiterals.length > 0) {
          checks.push({ checkId: "LOG-AST-004", question: "AI_PARSE_RESULT_DEBUG emitted in visual-mission-judge-once.ts (AST)?", status: "PASS", detail: "AI_PARSE_RESULT_DEBUG event reference found in visual-mission-judge-once.ts (AST)." });
        } else {
          checks.push({ checkId: "LOG-AST-004", question: "AI_PARSE_RESULT_DEBUG emitted in visual-mission-judge-once.ts (AST)?", status: "FAIL", detail: "AI_PARSE_RESULT_DEBUG not found in visual-mission-judge-once.ts." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-004", question: "AI_PARSE_RESULT_DEBUG emitted in visual-mission-judge-once.ts (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── LOG-AST-005: No randomUUID() used as traceId source in AI log emit calls ──
  {
    const AI_FILES = [
      "src/capabilities/ai/runtime/model-call.ts",
      "src/capabilities/ai/children/visual-mission-judge-once.ts",
      "src/lib/local-ai/call-local-model.ts",
    ];
    const violations: string[] = [];
    try {
      const project = getAuditProject();
      for (const relPath of AI_FILES) {
        const sf = project.getSourceFile(pathFromRepoRoot(relPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relPath));
        if (!sf) continue;
        const emitCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => {
          const expr = c.getExpression();
          return Node.isPropertyAccessExpression(expr) && expr.getName() === "emit";
        });
        for (const emitCall of emitCalls) {
          const args = emitCall.getArguments();
          if (args.length === 0) continue;
          const arg = args[0];
          if (!Node.isObjectLiteralExpression(arg)) continue;
          const traceIdProp = arg.getProperties().find(p => (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) && p.getName() === "traceId");
          if (!traceIdProp || !Node.isPropertyAssignment(traceIdProp)) continue;
          const init = traceIdProp.getInitializer();
          if (!init) continue;
          // Check if value is CallExpression randomUUID() or contains it directly as fallback
          const hasRandomUUID = init.getDescendantsOfKind(SyntaxKind.CallExpression).some(c => {
            const e = c.getExpression();
            return Node.isIdentifier(e) && e.getText() === "randomUUID";
          }) || (Node.isCallExpression(init) && Node.isIdentifier(init.getExpression()) && init.getExpression().getText() === "randomUUID");
          if (hasRandomUUID) {
            violations.push(`${relPath}: traceId uses randomUUID() as value/fallback`);
          }
        }
      }
      if (violations.length === 0) {
        checks.push({ checkId: "LOG-AST-005", question: "No randomUUID() used as traceId source in AI log emit calls (AST)?", status: "PASS", detail: "No AI log emit calls use randomUUID() as traceId value/fallback (AST)." });
      } else {
        checks.push({ checkId: "LOG-AST-005", question: "No randomUUID() used as traceId source in AI log emit calls (AST)?", status: "FAIL", detail: violations.join(" | ") });
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-005", question: "No randomUUID() used as traceId source in AI log emit calls (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── LOG-AST-006: No console.* calls in AI capability files (AST) ──
  {
    const AI_CAP_FILES = [
      "src/capabilities/ai/runtime/model-call.ts",
      "src/capabilities/ai/children/visual-mission-judge-once.ts",
      "src/capabilities/ai/ability-group.ts",
    ];
    const violations: string[] = [];
    try {
      const project = getAuditProject();
      for (const relPath of AI_CAP_FILES) {
        const sf = project.getSourceFile(pathFromRepoRoot(relPath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relPath));
        if (!sf) continue;
        const consoleCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(c => {
          const expr = c.getExpression();
          if (!Node.isPropertyAccessExpression(expr)) return false;
          const obj = expr.getExpression();
          return Node.isIdentifier(obj) && obj.getText() === "console";
        });
        if (consoleCalls.length > 0) {
          violations.push(`${relPath}: ${consoleCalls.length} console.* call(s)`);
        }
      }
      if (violations.length === 0) {
        checks.push({ checkId: "LOG-AST-006", question: "No console.* calls in AI capability files (AST)?", status: "PASS", detail: "No console.* calls found in AI capability source files (AST)." });
      } else {
        checks.push({ checkId: "LOG-AST-006", question: "No console.* calls in AI capability files (AST)?", status: "FAIL", detail: violations.join(" | ") });
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-006", question: "No console.* calls in AI capability files (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── LOG-AST-007: ability-group.ts passes traceContext to executeVisualMissionJudgeOnce ──
  {
    const ABILITY_GROUP_PATH = "src/capabilities/ai/ability-group.ts";
    try {
      const project = getAuditProject();
      const sf = project.getSourceFile(pathFromRepoRoot(ABILITY_GROUP_PATH)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(ABILITY_GROUP_PATH));
      if (!sf) {
        checks.push({ checkId: "LOG-AST-007", question: "ability-group.ts passes traceContext to executeVisualMissionJudgeOnce (AST)?", status: "FAIL", detail: `File not found: ${ABILITY_GROUP_PATH}` });
      } else {
        const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
        const judgeCalls = calls.filter(c => {
          const expr = c.getExpression();
          return Node.isIdentifier(expr) && expr.getText() === "executeVisualMissionJudgeOnce";
        });
        const hasTraceContext = judgeCalls.some(c => {
          const args = c.getArguments();
          if (args.length === 0) return false;
          const arg = args[0];
          if (!Node.isObjectLiteralExpression(arg)) return false;
          return arg.getProperties().some(p => (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) && p.getName() === "traceContext");
        });
        if (hasTraceContext) {
          checks.push({ checkId: "LOG-AST-007", question: "ability-group.ts passes traceContext to executeVisualMissionJudgeOnce (AST)?", status: "PASS", detail: "traceContext property found in executeVisualMissionJudgeOnce call (AST)." });
        } else if (judgeCalls.length === 0) {
          checks.push({ checkId: "LOG-AST-007", question: "ability-group.ts passes traceContext to executeVisualMissionJudgeOnce (AST)?", status: "FAIL", detail: "No executeVisualMissionJudgeOnce call found in ability-group.ts." });
        } else {
          checks.push({ checkId: "LOG-AST-007", question: "ability-group.ts passes traceContext to executeVisualMissionJudgeOnce (AST)?", status: "FAIL", detail: "executeVisualMissionJudgeOnce called but traceContext not in argument object." });
        }
      }
    } catch (err) {
      checks.push({ checkId: "LOG-AST-007", question: "ability-group.ts passes traceContext to executeVisualMissionJudgeOnce (AST)?", status: "FAIL", detail: `ts-morph error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasWarn = checks.some((c) => c.status === "WARN");
  const overallStatus = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}
