import { readFileSync } from "node:fs";

import { pathFromRepoRoot } from "../../core/paths.js";
import {
  DOM_AUTOMATION_BLUEPRINT_FILE_PATH,
  DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX,
  DOM_AUTOMATION_LAW_FILE_PATH,
  DOM_AUTOMATION_LAW_METADATA,
} from "./dom-automation-law-enforcement-matrix.js";
import type { BinaryInspectorClauseResult, BinaryInspectorLawResult, BinaryInspectorResult, LawEnforcementMatrixItem } from "./dom-automation-law-enforcement-types.js";
import {
  createDomAutomationBinaryCheckContext,
  evaluateDomAutomationMatrixItem,
} from "./dom-automation-law-binary-checks.js";

const heartbeatLine = (input: {
  lawId: string;
  clauseId: string;
  inspectorName: string;
  processed: number;
  total: number;
}): void => {
  process.stdout.write(
    `[DOM-AUTOMATION][HEARTBEAT] law=${input.lawId} clause=${input.clauseId} inspector=${input.inspectorName} processed=${input.processed} total=${input.total} status=running\n`,
  );
};

const lawLine = (input: { lawId: string; status: "PASS" | "FAIL"; passed: number; failed: number }): void => {
  process.stdout.write(
    `[DOM-AUTOMATION][LAW-${input.status}] law=${input.lawId} passed=${input.passed} failed=${input.failed}\n`,
  );
};

const buildSummary = (lawResults: ReadonlyArray<BinaryInspectorResult["lawResults"][number]>): BinaryInspectorResult["summary"] => {
  const totalClauses = lawResults.reduce((sum, lawResult) => sum + lawResult.clauseResults.length, 0);
  const passedClauses = lawResults.reduce((sum, lawResult) => sum + lawResult.clauseResults.filter((clause) => clause.status === "PASS").length, 0);
  const failedClauses = totalClauses - passedClauses;
  const passedLaws = lawResults.filter((lawResult) => lawResult.status === "PASS").length;
  const failedLaws = lawResults.length - passedLaws;
  return {
    totalLaws: lawResults.length,
    passedLaws,
    failedLaws,
    totalClauses,
    passedClauses,
    failedClauses,
  };
};

type InspectorHeartbeatState = {
  currentClause: LawEnforcementMatrixItem | undefined;
  processedClauses: number;
  totalClauses: number;
};

const assertDomAutomationAuthorityFiles = (): void => {
  readFileSync(pathFromRepoRoot(DOM_AUTOMATION_LAW_FILE_PATH), "utf8");
  readFileSync(pathFromRepoRoot(DOM_AUTOMATION_BLUEPRINT_FILE_PATH), "utf8");
};

const startHeartbeat = (state: InspectorHeartbeatState): ReturnType<typeof setInterval> =>
  setInterval(() => {
    if (!state.currentClause) {
      return;
    }
    heartbeatLine({
      lawId: state.currentClause.lawId,
      clauseId: state.currentClause.clauseId,
      inspectorName: state.currentClause.inspectorName,
      processed: state.processedClauses,
      total: state.totalClauses,
    });
  }, 5000);

const runMatrixClause = async (
  clause: LawEnforcementMatrixItem,
  context: ReturnType<typeof createDomAutomationBinaryCheckContext>,
): Promise<BinaryInspectorClauseResult> => {
  try {
    const outcome = await evaluateDomAutomationMatrixItem(clause, context);
    return {
      clauseId: clause.clauseId,
      status: outcome.status,
      enforcementLevel: clause.enforcementLevel,
      evidence: outcome.evidence,
      ...(outcome.failureReason ? { failureReason: outcome.failureReason } : {}),
    };
  } catch (error) {
    return {
      clauseId: clause.clauseId,
      status: "FAIL",
      enforcementLevel: clause.enforcementLevel,
      evidence: `inspector ${clause.inspectorName} threw unexpectedly`,
      failureReason: error instanceof Error ? error.message : String(error),
    };
  }
};

const runLawMatrix = async (
  lawId: string,
  context: ReturnType<typeof createDomAutomationBinaryCheckContext>,
  state: InspectorHeartbeatState,
): Promise<BinaryInspectorLawResult> => {
  const clauses = DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX.filter((item) => item.lawId === lawId);
  const clauseResults: BinaryInspectorClauseResult[] = [];
  for (const clause of clauses) {
    state.currentClause = clause;
    heartbeatLine({ lawId: clause.lawId, clauseId: clause.clauseId, inspectorName: clause.inspectorName, processed: state.processedClauses, total: state.totalClauses });
    clauseResults.push(await runMatrixClause(clause, context));
    state.processedClauses += 1;
  }
  const failed = clauseResults.filter((clause) => clause.status === "FAIL").length;
  const passed = clauseResults.length - failed;
  const status = failed === 0 ? "PASS" : "FAIL";
  lawLine({ lawId, status, passed, failed });
  return { lawId, status, clauseResults };
};

const buildInspectorResult = (lawResults: BinaryInspectorLawResult[]): BinaryInspectorResult => {
  const summary = buildSummary(lawResults);
  return {
    inspectorId: "dom-automation",
    status: summary.failedClauses === 0 ? "PASS" : "FAIL",
    lawResults,
    summary,
  };
};

export async function runDomAutomationInspector(): Promise<BinaryInspectorResult> {
  assertDomAutomationAuthorityFiles();
  const context = createDomAutomationBinaryCheckContext();
  const state: InspectorHeartbeatState = {
    currentClause: DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX[0],
    processedClauses: 0,
    totalClauses: DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX.length,
  };
  const heartbeat = startHeartbeat(state);
  try {
    const lawResults = [];
    for (const law of DOM_AUTOMATION_LAW_METADATA) {
      lawResults.push(await runLawMatrix(law.lawId, context, state));
    }
    return buildInspectorResult(lawResults);
  } finally {
    clearInterval(heartbeat);
  }
}
