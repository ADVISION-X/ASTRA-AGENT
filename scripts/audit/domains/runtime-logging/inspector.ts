// Runtime Logging Inspector — checks 10 governance questions.
// No giant report, no inventory. Only structured pass/fail findings.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
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
      checks.push({ checkId: "CHECK-06", question: "No console.log/error/warn/debug in production src (except whitelist)?", status: "PASS", detail: "No console debug patches found." });
    } else {
      checks.push({ checkId: "CHECK-06", question: "No console.log/error/warn/debug in production src (except whitelist)?", status: "FAIL", detail: `${violations.length} violation(s):\n  ${violations.slice(0, 10).join("\n  ")}` });
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

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasWarn = checks.some((c) => c.status === "WARN");
  const overallStatus = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}
