// Runtime Logging Inspector — observability health checks only.
// Checks: law active, file counts, schema fields, modes, redaction,
//         console scatter ban, AI four-piece presence, logger isolation.
// Does NOT check business logic, ability details, or AI correctness.

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

  // CHECK-01: Law file active, no retired laws
  {
    const src = readSrc(".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md");
    const hasActive = /status:\s*active/.test(src);
    const hasRetired = /status:\s*retired/.test(src);
    const hasSpine = /Runtime Log Spine/.test(src);
    if (hasActive && !hasRetired && hasSpine) {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "PASS", detail: "Active laws found; no retired laws." });
    } else if (!hasActive) {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "FAIL", detail: "No active laws in module-structured-logging." });
    } else if (hasRetired) {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "FAIL", detail: "Retired laws still present — law file not replaced." });
    } else {
      checks.push({ checkId: "CHECK-01", question: "module-structured-logging is active Runtime Log Spine (no retired laws)?", status: "WARN", detail: "Active laws found but 'Runtime Log Spine' branding missing." });
    }
  }

  // CHECK-02: src/lib/runtime-logs file count <= 8
  {
    const count = countFilesInDir("src/lib/runtime-logs");
    if (count === 0) {
      checks.push({ checkId: "CHECK-02", question: "src/lib/runtime-logs file count <= 8?", status: "FAIL", detail: "Directory missing or empty." });
    } else if (count <= RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles) {
      checks.push({ checkId: "CHECK-02", question: "src/lib/runtime-logs file count <= 8?", status: "PASS", detail: `${count} file(s) (limit: ${RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles}).` });
    } else {
      checks.push({ checkId: "CHECK-02", question: "src/lib/runtime-logs file count <= 8?", status: "FAIL", detail: `${count} file(s) — exceeds limit of ${RUNTIME_LOGGING_CONFIG.maxRuntimeLogFiles}.` });
    }
  }

  // CHECK-03: RuntimeLogEvent schema required fields
  {
    const src = readSrc("src/lib/runtime-logs/schema.ts");
    const missing = RUNTIME_LOGGING_CONFIG.requiredSchemaFields.filter((f) => !src.includes(f));
    if (missing.length === 0) {
      checks.push({ checkId: "CHECK-03", question: "RuntimeLogEvent schema has required fields?", status: "PASS", detail: "All required fields present." });
    } else {
      checks.push({ checkId: "CHECK-03", question: "RuntimeLogEvent schema has required fields?", status: "FAIL", detail: `Missing: ${missing.join(", ")}` });
    }
  }

  // CHECK-04: FLOW / DEBUG / TRACE modes exist
  {
    const src = readSrc("src/lib/runtime-logs/mode.ts");
    const missing = RUNTIME_LOGGING_CONFIG.requiredModes.filter((m) => !src.includes(`"${m}"`));
    if (missing.length === 0) {
      checks.push({ checkId: "CHECK-04", question: "FLOW / DEBUG / TRACE modes in mode.ts?", status: "PASS", detail: "All three modes present." });
    } else {
      checks.push({ checkId: "CHECK-04", question: "FLOW / DEBUG / TRACE modes in mode.ts?", status: "FAIL", detail: `Missing: ${missing.join(", ")}` });
    }
  }

  // CHECK-05: redactRuntimeLogPayload exists
  {
    const src = readSrc("src/lib/runtime-logs/redaction.ts");
    if (src.includes(RUNTIME_LOGGING_CONFIG.redactionFunctionName)) {
      checks.push({ checkId: "CHECK-05", question: "redactRuntimeLogPayload exists in redaction.ts?", status: "PASS", detail: "redactRuntimeLogPayload found." });
    } else {
      checks.push({ checkId: "CHECK-05", question: "redactRuntimeLogPayload exists in redaction.ts?", status: "FAIL", detail: "redactRuntimeLogPayload not found." });
    }
  }

  // CHECK-06: No console.log/error/warn/debug in production src
  {
    const srcFiles = gatherTsFiles(["src"]);
    const violations: string[] = [];
    for (const { rel, src } of srcFiles) {
      if (RUNTIME_LOGGING_CONFIG.consoleWhitelist.some((w) => rel.includes(w))) continue;
      for (const pattern of RUNTIME_LOGGING_CONFIG.forbiddenConsolePatterns) {
        const lines = src.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes(pattern) && !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*")) {
            violations.push(`${rel}:${idx + 1}`);
          }
        });
      }
    }
    if (violations.length === 0) {
      checks.push({ checkId: "CHECK-06", question: "No raw console output in production src?", status: "PASS", detail: "No console scatter found." });
    } else {
      checks.push({ checkId: "CHECK-06", question: "No raw console output in production src?", status: "FAIL", detail: `${violations.length} violation(s): ${violations.slice(0, 5).join(", ")}` });
    }
  }

  // CHECK-07–10: AI four-piece event types present in source
  const aiFiles = gatherTsFiles([...RUNTIME_LOGGING_CONFIG.aiSourcePaths, "src/lib/runtime-logs"]);
  const aiSrc = aiFiles.map((f) => f.src).join("\n");

  for (const { checkId, event, question } of [
    { checkId: "CHECK-07", event: "AI_REQUEST_DEBUG", question: "AI_REQUEST_DEBUG emitted before model call?" },
    { checkId: "CHECK-08", event: "AI_RAW_RESPONSE_DEBUG", question: "AI_RAW_RESPONSE_DEBUG emitted after model call?" },
    { checkId: "CHECK-09", event: "AI_PARSE_RESULT_DEBUG", question: "AI_PARSE_RESULT_DEBUG emitted after parse?" },
    { checkId: "CHECK-10", event: "AI_ERROR_DEBUG", question: "AI_ERROR_DEBUG emitted before AI failure?" },
  ] as const) {
    if (aiSrc.includes(event)) {
      checks.push({ checkId, question, status: "PASS", detail: `${event} found in AI/local-ai source.` });
    } else {
      checks.push({ checkId, question, status: "FAIL", detail: `${event} not found in AI/local-ai source.` });
    }
  }

  // RLOG-04: runtimeLogger injected into AI ability group
  {
    const src = readSrc("src/lib/local-runtime/workbench-assembly.ts");
    if (!src) {
      checks.push({ checkId: "RLOG-04", question: "runtimeLogger passed to createConfiguredAiAbilityGroup?", status: "FAIL", detail: "workbench-assembly.ts not found." });
    } else if (src.includes("createConfiguredAiAbilityGroup({ dataDir, runtimeLogger })")) {
      checks.push({ checkId: "RLOG-04", question: "runtimeLogger passed to createConfiguredAiAbilityGroup?", status: "PASS", detail: "runtimeLogger injected — AI events will fire." });
    } else {
      checks.push({ checkId: "RLOG-04", question: "runtimeLogger passed to createConfiguredAiAbilityGroup?", status: "FAIL", detail: "runtimeLogger not passed to AI ability group — AI events silently dropped." });
    }
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasWarn = checks.some((c) => c.status === "WARN");
  const overallStatus = hasFail ? "FAIL" : hasWarn ? "WARN" : "PASS";

  return { checks, overallStatus };
}
