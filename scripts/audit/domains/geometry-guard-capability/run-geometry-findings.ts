import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { geometryGuardInspectionConfig as config } from "./inspection-constants.js";
import type { GeometryForbiddenState, GeometryRequiredShapeState, PresenceEntry } from "./inspection-types.js";

const LAW_IDS = {
	OWNER: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V3",
	CONTRACT: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V3",
	INPUT_CHAIN: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3",
	COORDINATE: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V3",
	PIPELINE: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3",
	RESULT_PROOF: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3",
	DOWNSTREAM: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3",
	ENFORCEMENT: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
} as const;

const pushFailedCheck = (
	findings: Finding[],
	passed: boolean,
	finding: Parameters<typeof createFinding>[0],
): void => {
	if (!passed) {
		findings.push(createFinding(finding));
	}
};

const pushPresenceFindings = (findings: Finding[], requiredPresence: PresenceEntry[], forbiddenPresence: PresenceEntry[]): void => {
	for (const entry of requiredPresence) {
		pushFailedCheck(findings, entry.exists, { lawId: LAW_IDS.OWNER, file: entry.filePath, line: 1, severity: "fatal", message: "Geometry Guard required rebuild file is missing." });
	}
	for (const entry of forbiddenPresence) {
		pushFailedCheck(findings, !entry.exists, { lawId: LAW_IDS.OWNER, file: entry.filePath, line: 1, severity: "fatal", message: "Geometry Guard old shared implementation still exists after rebuild." });
	}
};

const pushRequiredShapeFindings = (findings: Finding[], requiredShapeState: GeometryRequiredShapeState, childImplementationViolations: string[]): void => {
	pushFailedCheck(findings, requiredShapeState.schemaSurfacePassed, { lawId: LAW_IDS.INPUT_CHAIN, file: config.SCHEMA_PATH, line: 1, severity: "error", message: "Geometry Guard schema must define the full chain-aware input, result, runtime proof, child ids, and failure reasons." });
	pushFailedCheck(findings, requiredShapeState.contractSurfacePassed, { lawId: LAW_IDS.CONTRACT, file: config.CONTRACT_PATH, line: 1, severity: "error", message: "Geometry Guard contract must expose only the rebuilt group and child execution surface." });
	pushFailedCheck(findings, requiredShapeState.abilityGroupPassed, { lawId: LAW_IDS.PIPELINE, file: config.ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Geometry Guard ability-group must parse input through schema and dispatch governed failures instead of throwing." });
	pushFailedCheck(findings, requiredShapeState.registryPassed, { lawId: LAW_IDS.OWNER, file: config.REGISTRY_PATH, line: 1, severity: "error", message: "Geometry Guard registry must expose only the eight rebuilt child ids." });
	pushFailedCheck(findings, requiredShapeState.indexPassed, { lawId: LAW_IDS.CONTRACT, file: config.INDEX_PATH, line: 1, severity: "fatal", message: "Geometry Guard index must use explicit exports and must not leak child paths." });
	pushFailedCheck(findings, requiredShapeState.childFactoryPassed, { lawId: LAW_IDS.PIPELINE, file: config.CHILD_FACTORY_PATH, line: 1, severity: "fatal", message: "Geometry Guard child factory must delegate into the shared executor." });
	if (childImplementationViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: childImplementationViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard child implementations must stay as thin factory delegates with no direct validation logic." }));
	}
	pushFailedCheck(findings, requiredShapeState.resultProofWiringPassed, { lawId: LAW_IDS.RESULT_PROOF, file: config.RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Geometry Guard result builder must preserve chain parity, output boundary, and runtime proof truth." });
	pushFailedCheck(findings, requiredShapeState.executorWiringPassed, { lawId: LAW_IDS.PIPELINE, file: config.EXECUTOR_PATH, line: 1, severity: "fatal", message: "Geometry Guard executor must own the full policy, coordinate-space, bounds, scale, click-safety, transform, and result chain." });
	pushFailedCheck(findings, requiredShapeState.coordinateGatePassed, { lawId: LAW_IDS.COORDINATE, file: `${config.ROOT}/runtime/coordinate-space-gate.ts`, line: 1, severity: "fatal", message: "Geometry Guard coordinate-space gate must explicitly block contactSheet execution and enforce desktopScreen deviceScaleFactor." });
	pushFailedCheck(findings, requiredShapeState.dispatchFailurePassed, { lawId: LAW_IDS.PIPELINE, file: `${config.ROOT}/runtime/geometry-dispatch-failure.ts`, line: 1, severity: "fatal", message: "Geometry Guard failure dispatch must never emit normalized executable geometry." });
};

const pushForbiddenFindings = (findings: Finding[], forbiddenState: GeometryForbiddenState): void => {
	if (forbiddenState.forbiddenImportViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.forbiddenImportViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard imports forbidden browser, action, or cross-group execution dependencies." }));
	}
	if (forbiddenState.forbiddenIdentifierViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.CONTRACT, file: forbiddenState.forbiddenIdentifierViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard still exposes forbidden browser, visual-target, or action-plan identifiers." }));
	}
	if (forbiddenState.businessLiteralViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.businessLiteralViolations[0]!.relativePath, line: 1, severity: "fatal", message: "Geometry Guard still contains forbidden platform-action vocabulary." }));
	}
	if (forbiddenState.capabilityCheckViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.ENFORCEMENT, file: forbiddenState.capabilityCheckViolations[0]!, line: 1, severity: "fatal", message: "capability-check.ts must not exist inside Geometry Guard." }));
	}
	if (forbiddenState.externalChildImports.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.externalChildImports[0]!, line: 1, severity: "fatal", message: "Geometry Guard child implementations must not be imported outside canonical root ownership." }));
	}
	if (forbiddenState.legacyContractOwners.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.CONTRACT, file: forbiddenState.legacyContractOwners[0]!, line: 1, severity: "fatal", message: "Duplicate Geometry Guard contract declarations were found outside canonical contract.ts." }));
	}
};

const pushEscapeFindings = (findings: Finding[], forbiddenState: GeometryForbiddenState): void => {
	if (forbiddenState.verifyViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.ENFORCEMENT, file: forbiddenState.verifyViolations[0]!.file, line: 1, severity: "fatal", message: "verify* functions must not exist inside Geometry Guard." }));
	}
	if (forbiddenState.clampViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.COORDINATE, file: forbiddenState.clampViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not silently clamp coordinates." }));
	}
	if (forbiddenState.throwViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.throwViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not throw directly; failures must be governed results." }));
	}
	if (forbiddenState.dateViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.dateViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must route time through the clock port rather than direct Date usage." }));
	}
	pushFailedCheck(findings, forbiddenState.clockPassed, { lawId: LAW_IDS.PIPELINE, file: config.CLOCK_PATH, line: 1, severity: "error", message: "Geometry Guard system clock must be the sole direct Date owner." });
	if (forbiddenState.typeEscapeViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.typeEscapeViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not use any, ts-ignore, or unknown-as escape hatches." }));
	}
	if (forbiddenState.driftPathViolations.length > 0) {
		findings.push(createFinding({ lawId: LAW_IDS.PIPELINE, file: forbiddenState.driftPathViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard must not introduce compat, legacy, bridge, or v2 paths." }));
	}
};

type GeometryFindingInput = {
	requiredPresence: PresenceEntry[];
	forbiddenPresence: PresenceEntry[];
	requiredShapeState: GeometryRequiredShapeState;
	forbiddenState: GeometryForbiddenState;
	childImplementationViolations: string[];
};

const getRequiredShapePhase = (requiredShapePassed: boolean): InspectorPhase => {
	return createPhase("geometry-guard-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Geometry Guard exposes the rebuilt schema, executor chain, clock, proof builder, and thin child delegates." : "Geometry Guard required rebuild shape is incomplete or still wired to the wrong owner surface.");
};

const getForbiddenShapePhase = (forbiddenState: GeometryForbiddenState): InspectorPhase => {
	return createPhase("geometry-guard-forbidden-shape", forbiddenState.forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenState.forbiddenShapePassed, forbiddenState.forbiddenShapePassed ? "Geometry Guard no longer carries old shared files, child leaks, or cross-group execution imports." : "Geometry Guard still carries forbidden old files, forbidden imports, child leaks, or execution vocabulary.");
};

const getBoundaryPhase = (forbiddenState: GeometryForbiddenState): InspectorPhase => {
	return createPhase("geometry-guard-boundary-attack", forbiddenState.boundaryAttackPassed ? "PASS" : "CODE VIOLATION", forbiddenState.boundaryAttackPassed, forbiddenState.boundaryAttackPassed ? "Geometry Guard keeps one canonical contract boundary and one shared executor chain." : "Geometry Guard still shows duplicate public boundaries or child-level logic drift.");
};

const getEscapePhase = (forbiddenState: GeometryForbiddenState): InspectorPhase => {
	return createPhase("geometry-guard-anti-escape", forbiddenState.antiEscapePassed ? "PASS" : "CODE VIOLATION", forbiddenState.antiEscapePassed, forbiddenState.antiEscapePassed ? "Geometry Guard has no throw escape, Date escape, clamp escape, type escape, or compat drift." : "Geometry Guard still contains an escape hatch that bypasses governed validation.");
};

export function buildGeometryFindings(
	input: GeometryFindingInput,
): Finding[] {
	const findings: Finding[] = [];
	pushPresenceFindings(findings, input.requiredPresence, input.forbiddenPresence);
	pushRequiredShapeFindings(findings, input.requiredShapeState, input.childImplementationViolations);
	pushForbiddenFindings(findings, input.forbiddenState);
	pushEscapeFindings(findings, input.forbiddenState);
	return findings;
}

export function createGeometryPhaseState(requiredShapePassed: boolean, forbiddenState: GeometryForbiddenState): InspectorPhase[] {
	return [
		getRequiredShapePhase(requiredShapePassed),
		getForbiddenShapePhase(forbiddenState),
		getBoundaryPhase(forbiddenState),
		getEscapePhase(forbiddenState),
	];
}
