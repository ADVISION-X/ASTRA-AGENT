import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import { hasBlockingFindings } from "./core/result.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, writeRunnerSummary } from "./core/runtime.js";
import type { InspectorResult, RunnerSummary } from "./core/schema.js";

const main = async (): Promise<void> => {
	await buildAuditArtifacts();

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
	const context = await createInspectorContext(artifacts);
	const results: InspectorResult[] = [];

	for (const planOwner of artifacts.auditPlan.owners) {
		const inspector = await loadInspector(planOwner.entry);
		const result = await inspector(context);
		results.push(result);
		process.stdout.write(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}\n`);
	}

	const summary: RunnerSummary = {
		generatedAt: new Date().toISOString(),
		phase: artifacts.auditPlan.phase,
		totals: {
			inspectors: results.length,
			passed: results.filter((result) => result.passed).length,
			failed: results.filter((result) => !result.passed).length,
			blocking: results.filter((result) => hasBlockingFindings(result.findings)).length + artifactBlockingCount,
		},
		results,
	};

	await writeRunnerSummary(summary);

	const blocking = artifactBlockingCount > 0 || results.some((result) => hasBlockingFindings(result.findings));
	if (blocking) {
		process.exitCode = 1;
	}
};

void main();