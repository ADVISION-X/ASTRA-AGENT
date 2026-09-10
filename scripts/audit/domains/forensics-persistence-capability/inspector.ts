import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorEvaluation, SessionInspectorOutput } from
  "../../shared/inspector-contracts.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs,
  validateStaticInspection } from "../../shared/static-inspection-contract.js";

const LAWS = ["LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V6",
  "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V6",
  "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V5"] as const;
const REQUIRED = [
  "src/capabilities/forensics-persistence/contract.ts",
  "src/capabilities/forensics-persistence/ability-group.ts",
  "src/capabilities/forensics-persistence/schema.ts",
  "src/capabilities/forensics-persistence/storage-adapter.ts",
  "src/capabilities/forensics-persistence/storage-port.ts",
  "src/capabilities/forensics-persistence/children/append-artifact/handler.ts",
  "src/capabilities/forensics-persistence/children/read-artifact-ref/handler.ts",
  "src/lib/storage/file-storage.ts", "src/lib/storage/storage-port.ts", "src/lib/storage/schema.ts",
] as const;
const RETIRED = [
  "src/capabilities/forensics-persistence/children/append-record/handler.ts",
  "src/capabilities/forensics-persistence/children/read-record-ref/handler.ts",
] as const;
const text = (context: InspectorContext, path: string): string =>
  context.project.getSourceFile(resolve(context.sealedRoot, path))?.getFullText() ?? "";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const findings: InspectorEvaluation["findings"] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, action: () => void): void => recordStaticCheck({
    check, findings, implementation: inspectDomainEvaluation, lawIds: [...LAWS],
    receipts: staticCheckReceipts, run: action,
  });
  run("inspectArtifactOnlyFiles", () => {
    for (const path of REQUIRED) if (!existsSync(resolve(context.sealedRoot, path))) findings.push(createFinding({
      evidenceMode: "static.ast", lawId: LAWS[0], clauseId: `${LAWS[0].toLowerCase()}-requirement`,
      checkId: "forensics/artifact-file-required", filePath: path, message: "Required artifact file is absent.",
    }));
    for (const path of RETIRED) if (existsSync(resolve(context.sealedRoot, path))) findings.push(createFinding({
      evidenceMode: "static.ast", lawId: LAWS[0], clauseId: `${LAWS[0].toLowerCase()}-requirement`,
      checkId: "forensics/record-ledger-retired", filePath: path, message: "Record ledger file remains.",
    }));
  });
  run("inspectArtifactOnlyContracts", () => {
    const source = REQUIRED.map((path) => text(context, path)).join("\n");
    for (const required of ["appendArtifact", "readArtifact", "FORENSICS_IDEMPOTENCY_CONFLICT",
      "integrityHash", "ai_raw_output"]) if (!source.includes(required)) findings.push(createFinding({
      evidenceMode: "static.contract", lawId: LAWS[1], clauseId: `${LAWS[1].toLowerCase()}-requirement`,
      checkId: "forensics/artifact-contract-required", filePath: REQUIRED[0], message: `Missing ${required}.`,
    }));
    for (const forbidden of ["appendRecord", "readRecord", "RecordEnvelope", "gpt-call-evidence:v1"])
      if (source.includes(forbidden)) findings.push(createFinding({
        evidenceMode: "static.contract", lawId: LAWS[2], clauseId: `${LAWS[2].toLowerCase()}-requirement`,
        checkId: "forensics/record-contract-retired", filePath: REQUIRED[0], message: `Retired ${forbidden} remains.`,
      }));
  });
  return { capabilityDomain: context.planEntry.capabilityDomain, reportedLawIds: context.planEntry.lawIds,
    findings, inspectedFiles: [...context.targetPaths], staticCheckReceipts };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawResult = (lawId: string) => ({ lawId,
    assertions: ["static.ast", "static.contract"].map((evidenceMode) => ({
      clauses: staticClauses(0), evidenceMode,
      passed: producerModePassed(evaluation.staticCheckReceipts, lawId,
        [evidenceMode === "static.ast" ? "inspectArtifactOnlyFiles" : "inspectArtifactOnlyContracts"]),
      refs: staticEvidenceRefs(context, lawId, evidenceMode, staticClauses(0),
        evaluation.staticCheckReceipts,
        [evidenceMode === "static.ast" ? "inspectArtifactOnlyFiles" : "inspectArtifactOnlyContracts"]),
    })), findings: evaluation.findings.filter((finding) => finding.lawId === lawId) });
  return validateStaticInspection(context, { capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds, lawResults: LAWS.map(lawResult),
    inspectedFiles: evaluation.inspectedFiles });
};
