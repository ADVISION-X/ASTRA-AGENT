import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";

import { runStructuredLoggingChecks } from "./run-structured-logging-checks.js";

const inspector: DomainInspector = async () => {
	const checks = await runStructuredLoggingChecks();
	const findings = [...checks.findings];
	const phases = [...checks.phases];
	const summary = phases.find((phase) => !phase.passed)?.summary ?? phases.at(-1)?.summary ?? "Structured logging governance passed.";

	return finalizeInspectorResult({
		inspector: "GrassEye Structured Logging Inspector",
		inspectorId: "structured-logging",
		capabilityDomain: "structured-logging",
		findings,
		phases,
		summary,
	});
};

export { inspector as inspectStructuredLoggingBoundary, inspector as structuredLoggingInspector };