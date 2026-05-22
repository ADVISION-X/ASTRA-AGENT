import { existsSync } from "node:fs";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { findLine, readRepoFile } from "./source-read.js";

const redactionPatterns = [
  "cookie",
  "cookies",
  "token",
  "authorization",
  "password",
  "api_key",
  "api-key",
  "secret",
  "session",
  "bearer",
  "auth",
  "localStorage",
  "sessionStorage",
  "base64",
  "signature",
] as const;

export const collectRedactionFindings = (_context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles = [
    "src/lib/runtime-logs/redaction.ts",
    "src/lib/runtime-logs/sinks.ts",
    "scripts/acceptance/runtime-log-redaction.acceptance.ts",
  ];
  const redaction = readRepoFile("src/lib/runtime-logs/redaction.ts");
  const sinks = readRepoFile("src/lib/runtime-logs/sinks.ts");
  if (!redaction) {
    findings.push({
      checkId: "runtime-log-spine/redaction-file",
      lawId: RuntimeLogSpineLaw.REDACTION,
      file: "src/lib/runtime-logs/redaction.ts",
      line: 1,
      severity: "fatal",
      message: "runtime log redaction is missing",
      hint: "Implement redaction for secret keys, storage data, signed URLs and base64-like material.",
    });
  } else {
    for (const pattern of redactionPatterns) {
      if (new RegExp(pattern, "iu").test(redaction.text)) continue;
      findings.push({
        checkId: "runtime-log-spine/redaction-pattern",
        lawId: RuntimeLogSpineLaw.REDACTION,
        file: redaction.path,
        line: 1,
        severity: "fatal",
        message: `redaction does not cover ${pattern}`,
        hint: "All terminal/file/debug bundle sinks must redact secrets and base64 before output.",
      });
    }
  }
  if (!sinks || !/redactRuntimeLogEvent/u.test(sinks.text)) {
    findings.push({
      checkId: "runtime-log-spine/sink-redaction",
      lawId: RuntimeLogSpineLaw.REDACTION,
      file: "src/lib/runtime-logs/sinks.ts",
      line: sinks ? findLine(sinks.text, "writeFileSink") : 1,
      severity: "fatal",
      message: "runtime log sink does not prove redaction before write",
      hint: "All terminal/file/debug bundle sinks must redact secrets and base64 before output.",
    });
  }
  if (!existsSync(resolveFromRepo("scripts/acceptance/runtime-log-redaction.acceptance.ts"))) {
    findings.push({
      checkId: "runtime-log-spine/redaction-acceptance",
      lawId: RuntimeLogSpineLaw.REDACTION,
      file: "scripts/acceptance/runtime-log-redaction.acceptance.ts",
      line: 1,
      severity: "fatal",
      message: "runtime log redaction acceptance is missing",
      hint: "Add acceptance proving cookies, tokens, signed URLs and base64 are redacted before sink output.",
    });
  }
  return { findings, inspectedFiles };
};
