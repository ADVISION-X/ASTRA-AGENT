import { buildAuditArtifacts } from "./build-audit-artifacts.js";
import { hasBlockingFindings } from "./core/result.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector, writeRunnerSummary } from "./core/runtime.js";
import type { InspectorResult, RunnerSummary } from "./core/schema.js";

const main = async (): Promise<void> => {
	await buildAuditArtifacts();

	const artifacts = await loadGeneratedArtifacts();
	const context = await createInspectorContext(artifacts);
	const results: InspectorResult[] = [];

	for (const planOwner of artifacts.auditPlan.owners) {
		const inspector = await loadInspector(planOwner.entry);
		const result = await inspector(context);
		results.push(result);
		console.log(`[${result.classification}] ${result.capabilityDomain}: ${result.summary}`);
	}

	const summary: RunnerSummary = {
		generatedAt: new Date().toISOString(),
		phase: artifacts.auditPlan.phase,
		totals: {
			inspectors: results.length,
			passed: results.filter((result) => result.passed).length,
			failed: results.filter((result) => !result.passed).length,
			blocking: results.filter((result) => hasBlockingFindings(result.findings)).length,
		},
		results,
	};

	await writeRunnerSummary(summary);

	const blocking = results.some((result) => hasBlockingFindings(result.findings));
	if (blocking) {
		process.exitCode = 1;
	}
};

void main();