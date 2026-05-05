import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";

import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runStructuredLoggingChecks } from "./run-structured-logging-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_STRUCTURED_LOGGING_NEGATIVE_PROOF";

const runConfiguredNegativeProof = async () => {
	return process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
		? {
				findings: [],
				phase: createPhase("negative-proof-harness", "PASS", true, "Structured logging negative-proof harness was skipped for nested inspector execution."),
			}
		: runNegativeProofHarness();
};

const inspector: DomainInspector = async () => {
	const checks = await runStructuredLoggingChecks();
	const negativeProof = await runConfiguredNegativeProof();
	const findings = [...checks.findings, ...negativeProof.findings];
	const phases = [...checks.phases, negativeProof.phase];
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