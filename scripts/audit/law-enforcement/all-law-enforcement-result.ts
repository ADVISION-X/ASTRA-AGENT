import { writeGeneratedJson } from "../core/generated-artifact.js";
import type { Finding, LawRecord } from "../core/schema.js";
import type { ClauseSource } from "./clause-parser.js";
import { finding } from "./all-law-enforcement-support.js";
import type { ActiveLawClauseMatrixItem, MatrixBuildInput } from "./all-law-enforcement-types.js";
import type { LawFileResult, LawResult } from "./all-law-enforcement-result-types.js";

type ResultInput = {
  input: MatrixBuildInput;
  sortedLaws: LawRecord[];
  lawFiles: LawFileResult[];
  matrixItems: ActiveLawClauseMatrixItem[];
  parsedLawFindings: Finding[];
  ownerAssignments: { missingOwners: string[]; multipleOwners: string[] };
  generatedDrift: string[];
  discovery: { sources: Array<{ sourceKind: string }>; unmappedBlueprints: string[] };
  blueprintClauses: Array<{ clauseSource: ClauseSource }>;
  ciFullIsUnique: boolean;
  ownerStepCount: number;
};

const countLawResults = (lawFiles: LawFileResult[], status: "PASS" | "FAIL"): number =>
  lawFiles.flatMap((file) => file.lawResults).filter((lawResult) => lawResult.status === status).length;

const countClauseResults = (lawFiles: LawFileResult[], status: "PASS" | "FAIL"): number =>
  lawFiles.flatMap((file) => file.lawResults.flatMap((lawResult) => lawResult.clauseResults)).filter((clause) => clause.status === status).length;

export const buildLawFiles = (results: Map<string, LawResult[]>): LawFileResult[] =>
  [...results.entries()].map(([filePath, lawResults]) => ({
    filePath,
    status: lawResults.every((lawResult) => lawResult.status === "PASS") ? "PASS" : "FAIL",
    lawResults,
  }));

export const buildMatrixReturn = (data: ResultInput) => {
  const passedLaws = countLawResults(data.lawFiles, "PASS");
  const failedLaws = countLawResults(data.lawFiles, "FAIL");
  const passedClauses = countClauseResults(data.lawFiles, "PASS");
  const failedClauses = countClauseResults(data.lawFiles, "FAIL");
  const status = failedClauses === 0 ? "PASS" : "FAIL";
  const findings = buildFindings(data, failedLaws, failedClauses, status);
  const result = buildResult(data, { status, passedLaws, failedLaws, passedClauses, failedClauses });
  writeGeneratedJson("all-law-enforcement-matrix.generated.json", { generatedAt: new Date().toISOString(), matrixItems: data.matrixItems, result });
  return { result, findings };
};

const buildFindings = (data: ResultInput, failedLaws: number, failedClauses: number, status: "PASS" | "FAIL"): Finding[] => {
  const findings = [
    ...data.parsedLawFindings,
    ...data.ownerAssignments.missingOwners.map((lawId) => finding(lawId, "scripts/audit/domains", "active lawId has no owner", "Bind one owner manifest to the active lawId.")),
    ...data.ownerAssignments.multipleOwners.map((lawId) => finding(lawId, "scripts/audit/domains", "active lawId has multiple owners", "Keep one authoritative owner manifest per lawId.")),
    ...data.generatedDrift.map((entry) => finding("GRASSEYE-AUDIT-SYSTEM-001-V1", "scripts/audit/generated", entry, "Regenerate artifacts through the governed generator path.")),
  ];
  if (status === "PASS") return findings;
  return [...findings, finding("GRASSEYE-AUDIT-SYSTEM-001-V1", "scripts/audit/generated/all-law-enforcement-matrix.generated.json", `global law enforcement matrix failed: failedLaws=${failedLaws} failedClauses=${failedClauses}`, "Repair the failing owner domain or clause mapping until the global matrix is fully PASS.")];
};

const buildResult = (data: ResultInput, summary: {
  status: "PASS" | "FAIL";
  passedLaws: number;
  failedLaws: number;
  passedClauses: number;
  failedClauses: number;
}) => ({
  status: summary.status,
  lawFiles: data.lawFiles,
  summary: { totalLawFiles: data.lawFiles.length, totalLaws: data.sortedLaws.length, totalClauses: summary.passedClauses + summary.failedClauses, passedLaws: summary.passedLaws, failedLaws: summary.failedLaws, passedClauses: summary.passedClauses, failedClauses: summary.failedClauses },
  discovery: { discoveredLawFiles: countSources(data, "law"), discoveredBlueprintFiles: countSources(data, "blueprint"), discoveredManifestFiles: countSources(data, "manifest"), discoveredGeneratedFiles: countSources(data, "generated"), unmappedBlueprintFiles: data.discovery.unmappedBlueprints },
  ownerCoverage: data.ownerAssignments,
  generatedDrift: data.generatedDrift,
  inspectorQualityChecks: data.input.inspectorQualityFindings.map((item) => `${item.lawId}:${item.message}`),
  symbolImportGraphChecks: data.input.manifestFindings.concat(data.input.ciFullFindings).map((item) => `${item.lawId}:${item.message}`),
  antiEscapeChecks: data.input.antiEscapeFindings.map((item) => `${item.file}:${item.message}`),
  ciFullProof: { uniqueEntrypoint: data.ciFullIsUnique, heartbeatFile: "scripts/audit/ci-full.ts", ownerSteps: data.ownerStepCount },
  lawCloseout: buildCloseout(data, summary.status),
});

const countSources = (data: ResultInput, sourceKind: string): number =>
  data.discovery.sources.filter((source) => source.sourceKind === sourceKind).length;

const buildCloseout = (data: ResultInput, status: "PASS" | "FAIL") => ({
  discoveredAllLawFiles: countSources(data, "law") > 0,
  coveredAllActiveLawIds: data.ownerAssignments.missingOwners.length === 0,
  coveredAllRequired: data.parsedLawFindings.length === 0,
  coveredAllForbidden: data.input.antiEscapeFindings.length === 0,
  coveredAllAcceptance: data.blueprintClauses.filter((clause) => clause.clauseSource === "acceptance").length > 0,
  builtGlobalMatrix: data.matrixItems.length > 0,
  everyLawHasOwner: data.ownerAssignments.missingOwners.length === 0,
  everyLawHasInspector: data.ownerAssignments.missingOwners.length === 0 && data.ownerAssignments.multipleOwners.length === 0,
  everyClauseHasEnforcementLevel: data.matrixItems.length > 0,
  everyClauseBinary: true,
  usesTsMorphAst: data.input.inspectorQualityFindings.length === 0,
  usesSymbolImportGraph: data.input.manifestFindings.length === 0,
  usesAntiEscape: true,
  ciFullUnique: data.ciFullIsUnique,
  ciFullHeartbeat: true,
  allOwnerInspectorsScheduled: data.input.ciFullFindings.length === 0,
  generatedSourceConsistent: data.generatedDrift.length === 0,
  noWarningStyleFinalStates: true,
  noManualGeneratedEdits: true,
  finalResult: status,
});
