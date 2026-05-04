import path from "node:path";
import { readFile } from "node:fs/promises";

type AuditTotals = {
	failed: number;
	inspectors: number;
	passed: number;
	blocking: number;
};

const buildUnavailableAuditSummary = (_error: unknown) => ({
	phase: "phase-04-full-enforcement",
	activeLawDomains: [],
	lastGeneratedAt: null,
	lastRunGeneratedAt: null,
	totals: null as AuditTotals | null,
});

const readAuditSummary = async () => {
	try {
		const [runnerSummaryText, phaseGateText] = await Promise.all([
			readFile(path.join(process.cwd(), "scripts", "audit", "generated", "runner-summary.json"), "utf8"),
			readFile(path.join(process.cwd(), "scripts", "audit", "phase-gates", "phase-04-full-enforcement.json"), "utf8"),
		]);
		const runnerSummary = JSON.parse(runnerSummaryText) as { generatedAt?: string; totals?: AuditTotals | null };
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

export const createAuditReadModel = () => ({ readAuditSummary });