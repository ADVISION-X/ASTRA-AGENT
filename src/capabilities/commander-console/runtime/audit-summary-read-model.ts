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

export const readAuditSummary = async (): Promise<CommanderAuditSummary> => {
  try {
    const [runnerSummaryText, phaseGateText] = await Promise.all([
      readFile(path.join(process.cwd(), "scripts", "audit", "generated", "runner-summary.json"), "utf8"),
      readFile(path.join(process.cwd(), "scripts", "audit", "phase-gates", "phase-04-full-enforcement.json"), "utf8"),
    ]);
    const runnerSummary = JSON.parse(runnerSummaryText) as { generatedAt?: string; totals?: CommanderAuditSummary["totals"] };
    const phaseGate = JSON.parse(phaseGateText) as { phase: string; activeLawDomains: string[] };
    return {
      phase: phaseGate.phase,
      activeLawDomains: phaseGate.activeLawDomains,
      lastGeneratedAt: phaseGate.phase ? runnerSummary.generatedAt ?? null : null,
      lastRunGeneratedAt: runnerSummary.generatedAt ?? null,
      totals: runnerSummary.totals ?? null,
    };
  } catch (error) {
    return buildUnavailableAuditSummary(error);
  }
};