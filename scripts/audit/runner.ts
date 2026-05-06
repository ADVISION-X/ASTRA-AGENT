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
const RUN_NEGATIVE_PROOF_ENV = "GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF";
const DEFAULT_AUDIT_HEAVY_PROOF_SKIP_ENV = [
	"GRASSEYE_SKIP_AI_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY",
	"GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_COMMANDER_STARTUP_EXIT_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF",
	"GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF",
] as const;

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

const applyDefaultNegativeProofPolicy = (): void => {
	if (process.env[RUN_NEGATIVE_PROOF_ENV] === "1") {
		process.stdout.write("[AUDIT] production mutation negative proof enabled by GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1.\n");
		return;
	}

	for (const envName of DEFAULT_AUDIT_HEAVY_PROOF_SKIP_ENV) {
		process.env[envName] = "1";
	}
	process.stdout.write("[AUDIT] production mutation negative proof skipped for default law-compliance audit.\n");
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
	applyDefaultNegativeProofPolicy();
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
