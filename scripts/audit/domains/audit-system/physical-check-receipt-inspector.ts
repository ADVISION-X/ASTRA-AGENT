import type { SourceFile } from "ts-morph";

import { directCallNames, directObjectPropertyNames, directVariableCalls } from "./ci-integrity-ast.js";

type Finding = { code: string; detail: string; path: string };

export const inspectPhysicalCheckReceipt = (source: SourceFile): Finding[] => {
  const runCheck = source.getFunction("runCheck");
  const calls = directCallNames(runCheck);
  const properties = directObjectPropertyNames(runCheck, "receipt");
  const findings: Finding[] = [];
  if (!directVariableCalls(runCheck, "before", "candidateSnapshot")) findings.push({ code: "AUDIT_PHYSICAL_CHECK_MISSING", detail: "before:candidateSnapshot", path: source.getFilePath() });
  if (!directVariableCalls(runCheck, "after", "candidateSnapshot")) findings.push({ code: "AUDIT_PHYSICAL_CHECK_MISSING", detail: "after:candidateSnapshot", path: source.getFilePath() });
  for (const required of ["spawnSync", "validateClaims", "writeEvidence"]) if (!calls.includes(required)) findings.push({ code: "AUDIT_PHYSICAL_CHECK_MISSING", detail: required, path: source.getFilePath() });
  for (const required of ["candidateSnapshot", "claims", "command", "evidenceModes", "exitStatus", "finding", "finishedAt", "lawIds", "outcome", "phaseId", "schemaVersion", "startedAt", "stderrSha256", "stdoutSha256", "testId"]) if (!properties.has(required)) findings.push({ code: "AUDIT_RECEIPT_FIELD_MISSING", detail: required, path: source.getFilePath() });
  return findings;
};
