import type { Finding } from "../../core/schema.js";

import { runForensicsStructuredLogRuntimeChecks } from "./run-forensics-structured-log-runtime-checks.js";
import { runForensicsStructuredLogSchemaChecks } from "./run-forensics-structured-log-schema-checks.js";

export function runForensicsStructuredLoggingChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...runForensicsStructuredLogSchemaChecks(project),
    ...runForensicsStructuredLogRuntimeChecks(project),
  ];
}