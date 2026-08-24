import type { SourceFile } from "ts-morph";

import { directCallNames, directObjectPropertyNames, directVariableCalls } from "./ci-integrity-ast.js";

type Finding = { code: string; detail: string; path: string };

export const inspectPhysicalCheckReceipt = (source: SourceFile): Finding[] => {
  const runCheck = source.getFunction("runCheck");
  const execute = source.getFunction("executeProjectScript");
  const evidence = source.getFunction("scriptEvidence");
  const calls = directCallNames(runCheck);
  const executeCalls = directCallNames(execute);
  const evidenceCalls = directCallNames(evidence);
  const properties = directObjectPropertyNames(evidence, "receipt");
  const findings: Finding[] = [];
  if (!directVariableCalls(execute, "before", "candidateSnapshot")) findings.push({ code: "AUDIT_PHYSICAL_CHECK_MISSING", detail: "before:candidateSnapshot", path: source.getFilePath() });
  if (!directVariableCalls(execute, "candidate", "candidateSnapshot")) findings.push({ code: "AUDIT_PHYSICAL_CHECK_MISSING", detail: "candidate:candidateSnapshot", path: source.getFilePath() });
  if(!calls.includes("validateClaims"))findings.push({code:"AUDIT_PHYSICAL_CHECK_MISSING",detail:"validateClaims",path:source.getFilePath()});
  if(!executeCalls.includes("spawnSync"))findings.push({code:"AUDIT_PHYSICAL_CHECK_MISSING",detail:"spawnSync",path:source.getFilePath()});
  if(!evidenceCalls.includes("writeEvidence"))findings.push({code:"AUDIT_PHYSICAL_CHECK_MISSING",detail:"writeEvidence",path:source.getFilePath()});
  for (const required of ["candidateSnapshot", "claims", "command", "evidenceModes", "exitStatus", "finding", "finishedAt", "lawIds", "outcome", "phaseId", "schemaVersion", "startedAt", "stderrSha256", "stdoutSha256", "testId"]) if (!properties.has(required)) findings.push({ code: "AUDIT_RECEIPT_FIELD_MISSING", detail: required, path: source.getFilePath() });
  return findings;
};
