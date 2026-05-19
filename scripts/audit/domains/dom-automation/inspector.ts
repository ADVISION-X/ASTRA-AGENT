import { readFileSync } from "node:fs";

import { pathFromRepoRoot } from "../../core/paths.js";
import {
  DOM_AUTOMATION_BLUEPRINT_FILE_PATH,
  DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX,
  DOM_AUTOMATION_LAW_FILE_PATH,
  DOM_AUTOMATION_LAW_METADATA,
  type BinaryInspectorClauseResult,
  type BinaryInspectorResult,
} from "./dom-automation-law-enforcement-matrix.js";
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

export async function runDomAutomationInspector(): Promise<BinaryInspectorResult> {
  readFileSync(pathFromRepoRoot(DOM_AUTOMATION_LAW_FILE_PATH), "utf8");
  readFileSync(pathFromRepoRoot(DOM_AUTOMATION_BLUEPRINT_FILE_PATH), "utf8");

  const context = createDomAutomationBinaryCheckContext();
  const totalClauses = DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX.length;
  let processedClauses = 0;
  let currentClause = DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX[0];

  const heartbeat = setInterval(() => {
    if (!currentClause) {
      return;
    }
    heartbeatLine({
      lawId: currentClause.lawId,
      clauseId: currentClause.clauseId,
      inspectorName: currentClause.inspectorName,
      processed: processedClauses,
      total: totalClauses,
    });
  }, 5000);

  try {
    const lawResults: BinaryInspectorResult["lawResults"][number][] = [];
    for (const law of DOM_AUTOMATION_LAW_METADATA) {
      const clauses = DOM_AUTOMATION_LAW_ENFORCEMENT_MATRIX.filter((item) => item.lawId === law.lawId);
      const clauseResults: BinaryInspectorClauseResult[] = [];
      for (const clause of clauses) {
        currentClause = clause;
        heartbeatLine({
          lawId: clause.lawId,
          clauseId: clause.clauseId,
          inspectorName: clause.inspectorName,
          processed: processedClauses,
          total: totalClauses,
        });
        try {
          const outcome = await evaluateDomAutomationMatrixItem(clause, context);
          clauseResults.push({
            clauseId: clause.clauseId,
            status: outcome.status,
            enforcementLevel: clause.enforcementLevel,
            evidence: outcome.evidence,
            ...(outcome.failureReason ? { failureReason: outcome.failureReason } : {}),
          });
        } catch (error) {
          clauseResults.push({
            clauseId: clause.clauseId,
            status: "FAIL",
            enforcementLevel: clause.enforcementLevel,
            evidence: `inspector ${clause.inspectorName} threw unexpectedly`,
            failureReason: error instanceof Error ? error.message : String(error),
          });
        }
        processedClauses += 1;
      }
      const failed = clauseResults.filter((clause) => clause.status === "FAIL").length;
      const passed = clauseResults.length - failed;
      const status = failed === 0 ? "PASS" : "FAIL";
      lawLine({ lawId: law.lawId, status, passed, failed });
      lawResults.push({ lawId: law.lawId, status, clauseResults });
    }
    const summary = buildSummary(lawResults);
    return {
      inspectorId: "dom-automation",
      status: summary.failedClauses === 0 ? "PASS" : "FAIL",
      lawResults,
      summary,
    };
  } finally {
    clearInterval(heartbeat);
  }
}
