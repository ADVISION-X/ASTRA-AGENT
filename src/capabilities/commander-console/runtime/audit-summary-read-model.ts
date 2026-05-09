import path from "node:path";
import { readFile } from "node:fs/promises";

import type { CommanderAuditSummary } from "../index.js";

const buildUnavailableAuditSummary = (_error: unknown): CommanderAuditSummary => ({
  phase: "phase-04-full-enforcement",
  activeLawDomains: [],
  lastGeneratedAt: null,
  lastRunGeneratedAt: null,
  totals: null,
});

type CiFullSummary = {
  generatedAt?: string;
  layers?: Array<{
    steps?: Array<{
      status?: string;
    }>;
  }>;
};

const collectCiFullTotals = (summary: CiFullSummary): CommanderAuditSummary["totals"] => {
  const steps = (summary.layers ?? []).flatMap((layer) => layer.steps ?? []);
  return {
    inspectors: steps.length,
    passed: steps.filter((step) => step.status === "PASS").length,
    failed: steps.filter((step) => step.status === "FAIL").length,
    blocking: steps.filter((step) => step.status === "FAIL").length,
  };
};

export const readAuditSummary = async (): Promise<CommanderAuditSummary> => {
  try {
    const [ciFullSummaryText, phaseGateText] = await Promise.all([
      readFile(path.join(process.cwd(), "scripts", "audit", "generated", "ci-full-summary.generated.json"), "utf8"),
      readFile(path.join(process.cwd(), "scripts", "audit", "phase-gates", "phase-04-full-enforcement.json"), "utf8"),
    ]);
    const ciFullSummary = JSON.parse(ciFullSummaryText) as CiFullSummary;
    const phaseGate = JSON.parse(phaseGateText) as { phase: string; activeLawDomains: string[] };
    return {
      phase: phaseGate.phase,
      activeLawDomains: phaseGate.activeLawDomains,
      lastGeneratedAt: phaseGate.phase ? ciFullSummary.generatedAt ?? null : null,
      lastRunGeneratedAt: ciFullSummary.generatedAt ?? null,
      totals: collectCiFullTotals(ciFullSummary),
    };
  } catch (error) {
    return buildUnavailableAuditSummary(error);
  }
};
