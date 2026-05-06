import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import { hasBlockingFindings } from "./core/result.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, writeRunnerSummary } from "./core/runtime.js";
import type { RunnerSummary } from "./core/schema-runner.js";
import type { InspectorResult } from "./core/schema.js";

const DEFAULT_STEP_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS_BY_DOMAIN: Record<string, number> = {
	"map-plugin-package": 600_000,
	"audit-system": 900_000,
	"ai-capability": 420_000,
	"orchestration-capability": 300_000,
	"page-state-capability": 300_000,
};

const resolveStepTimeoutMs = (label: string): number => STEP_TIMEOUT_MS_BY_DOMAIN[label] ?? DEFAULT_STEP_TIMEOUT_MS;

const buildSummary = (input: {
	phase: string;
	results: InspectorResult[];
	artifactBlockingCount: number;
}): RunnerSummary => {
	const totals = {
		inspectors: input.results.length,
		passed: input.results.filter((result) => result.passed).length,
		failed: input.results.filter((result) => !result.passed).length,
		blocking: input.results.filter((result) => hasBlockingFindings(result.findings)).length + input.artifactBlockingCount,
	};
	return {
		generatedAt: new Date().toISOString(),
		phase: input.phase,
		passed: totals.inspectors > 0 && totals.failed === 0 && totals.blocking === 0 && totals.passed === totals.inspectors,
		totals,
		results: input.results,
	};
};

const exitNow = (code: number): never => {
	process.exit(code);
};

const runWithTimeout = async <T>(label: string, task: Promise<T>): Promise<T> => {
	const timeoutMs = resolveStepTimeoutMs(label);
	let timeoutHandle: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(new Error(`${label} exceeded ${timeoutMs}ms`));
		}, timeoutMs);
	});

	try {
		return await Promise.race([task, timeout]);
	} finally {
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
		}
	}
};

const main = async (): Promise<void> => {
	process.stdout.write("[AUDIT] rebuilding generated artifacts...\n");
	await runWithTimeout("audit artifact rebuild", buildAuditArtifacts());
	process.stdout.write("[AUDIT] generated artifacts rebuilt; loading audit plan...\n");

	const artifacts = await loadGeneratedArtifacts();
	const artifactBlockingCount = artifacts.auditConflicts.conflicts.length + (artifacts.auditPlan.owners.length === 0 ? 1 : 0);
	if (artifacts.auditConflicts.conflicts.length > 0) {
		for (const conflict of artifacts.auditConflicts.conflicts) {
			console.error(`[AUDIT-CONFLICT] ${conflict.kind} ${conflict.capabilityDomain ?? "unknown-domain"} ${conflict.lawId ?? "no-law-id"}: ${conflict.message}`);
		}
	}
	if (artifacts.auditPlan.owners.length === 0) {
		console.error("[AUDIT-CONFLICT] audit plan produced zero owners; owner deletion or phase-gate drift is a blocking enforcement failure.");
	}
	if (artifactBlockingCount > 0) {
		await writeRunnerSummary(buildSummary({ phase: artifacts.auditPlan.phase, results: [], artifactBlockingCount }));
		process.stderr.write(`[AUDIT FAIL-FAST] stopped before inspector execution because generated artifacts have ${artifactBlockingCount} blocking issue(s).\n`);
		exitNow(1);
	}

	await writeRunnerSummary(buildSummary({ phase: artifacts.auditPlan.phase, results: [], artifactBlockingCount }));
	const context = await createInspectorContext(artifacts);
	const results: InspectorResult[] = [];
	process.stdout.write(`[AUDIT] running ${artifacts.auditPlan.owners.length} planned inspections with fail-fast enabled...\n`);

	for (const planOwner of artifacts.auditPlan.owners) {
		process.stdout.write(`[AUDIT] starting ${planOwner.capabilityDomain}...\n`);
		const inspector = await loadInspector(planOwner.entry);
		const result = await runWithTimeout(planOwner.capabilityDomain, inspector(context));
		results.push(result);
		process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);

		if (hasBlockingFindings(result.findings)) {
			const summary = buildSummary({ phase: artifacts.auditPlan.phase, results, artifactBlockingCount });
			await writeRunnerSummary(summary);
			process.stderr.write(`[AUDIT FAIL-FAST] stopped at ${result.capabilityDomain}; ${summary.totals.blocking} blocking issue(s) recorded.\n`);
			exitNow(1);
		}
	}

	const summary = buildSummary({ phase: artifacts.auditPlan.phase, results, artifactBlockingCount });
	await writeRunnerSummary(summary);
	process.stdout.write(`[AUDIT PASS] completed ${summary.totals.passed}/${summary.totals.inspectors} inspections with zero blocking findings.\n`);
	exitNow(0);
};

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.stack ?? error.message : String(error);
	const prefix = message.includes("exceeded ") ? "AUDIT FAIL-FAST" : "AUDIT ERROR";
	process.stderr.write(`[${prefix}] ${message}\n`);
	exitNow(1);
});
