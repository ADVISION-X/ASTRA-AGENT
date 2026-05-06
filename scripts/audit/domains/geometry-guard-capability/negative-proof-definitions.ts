export type ReplaceMutation = {
	kind: "replace";
	name: string;
	file: string;
	oldText: string;
	newText: string;
};

export type NegativeProofMutation = ReplaceMutation;

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

export const OWNER_BINDING_MUTATION_NAMES = [
	"manual-first-enforcement-reintroduced",
	"turn-p0-into-warning-only",
	"platform-adapter-is-coordinate-safe",
] as const;

export const MUTATIONS: NegativeProofMutation[] = [
	{
		kind: "replace",
		name: "manual-first-enforcement-reintroduced",
		file: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md",
		oldText: "status: active\ntier: P0\ncapabilityDomain: geometry-guard-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
		newText: "status: active\ntier: P0\ncapabilityDomain: geometry-guard-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
	},
	{
		kind: "replace",
		name: "turn-p0-into-warning-only",
		file: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md",
		oldText: "status: active\ntier: P0\ncapabilityDomain: geometry-guard-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
		newText: "status: active\ntier: P1\ncapabilityDomain: geometry-guard-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
	},
	{
		kind: "replace",
		name: "forbidden-plan-coordinate-action-child",
		file: "src/capabilities/geometry-guard/registry.ts",
		oldText: "    [\"validate-desktop-screen-bounds\", createValidateDesktopScreenBoundsCapability()],",
		newText: "    [\"validate-desktop-screen-bounds\", createValidateDesktopScreenBoundsCapability()],\n    [\"plan-coordinate-action\", createValidateDesktopScreenBoundsCapability() as never],",
	},
	{
		kind: "replace",
		name: "mouse-click-scale-mapping-remap",
		file: "src/capabilities/mouse-click/runtime/mouse-click-execution-seed.ts",
		oldText: "  const inputRef = input.inputRef;",
		newText: "  const inputRef = input.inputRef;\n  const remapScaleMapping = true;",
	},
	{
		kind: "replace",
		name: "platform-adapter-is-coordinate-safe",
		file: "src/lib/local-runtime/workbench-browser-runtime.ts",
		oldText: "  const browserSessionConfig = createLocalBrowserSessionConfig({",
		newText: "  const isCoordinateSafe = () => true;\n  const browserSessionConfig = createLocalBrowserSessionConfig({",
	},
	{
		kind: "replace",
		name: "fallback-mode-result-escape",
		file: "src/capabilities/geometry-guard/runtime/geometry-result-builder.ts",
		oldText: "    sourceVisualTargetResultRef: input.request.sourceVisualTargetResultRef,",
		newText: "    sourceVisualTargetResultRef: input.request.sourceVisualTargetResultRef,\n    fallbackMode: \"soft-clamp\",",
	},
	{
		kind: "replace",
		name: "remove-capabilityCallId-from-input",
		file: "src/capabilities/geometry-guard/schema-input.ts",
		oldText: "  capabilityCallId: nullableString,",
		newText: "  capabilityCallIdRemoved: nullableString,",
	},
	{
		kind: "replace",
		name: "remove-activationSnapshotRef-from-input",
		file: "src/capabilities/geometry-guard/schema-input.ts",
		oldText: "  activationSnapshotRef: nullableString,",
		newText: "  activationSnapshotRefRemoved: nullableString,",
	},
	{
		kind: "replace",
		name: "remove-nerveBusEnvelopeId-from-input",
		file: "src/capabilities/geometry-guard/schema-input.ts",
		oldText: "  nerveBusEnvelopeId: nullableString,",
		newText: "  nerveBusEnvelopeIdRemoved: nullableString,",
	},
	{
		kind: "replace",
		name: "silent-clamp-introduced",
		file: "src/capabilities/geometry-guard/shared/geometry-transform.ts",
		oldText: "    width: roundValue(bbox.width, policy),",
		newText: "    width: Math.max(1, roundValue(bbox.width, policy)),",
	},
	{
		kind: "replace",
		name: "proof-runId-from-session-child",
		file: "src/capabilities/geometry-guard/runtime/geometry-proof-builder.ts",
		oldText: "    runId: input.request.runId,",
		newText: "    runId: buildStableGeometryRef([input.request.sessionId, input.request.childCapabilityId, input.request.roundId, input.request.videoVisitId]),",
	},
	{
		kind: "replace",
		name: "allow-without-outputRef",
		file: "src/capabilities/geometry-guard/runtime/geometry-result-builder.ts",
		oldText: "    outputRef: allowSuccess ? buildStableGeometryRef([geometryGuardRef, \"output\", input.request.idempotencyKey]) : null,",
		newText: "    outputRef: null,",
	},
	{
		kind: "replace",
		name: "failed-with-output",
		file: "src/capabilities/geometry-guard/runtime/geometry-result-builder.ts",
		oldText: "    output: decisionState.allowSuccess ? input.output : null,",
		newText: "    output: input.output,",
	},
	{
		kind: "replace",
		name: "child-imports-browser-controller",
		file: "src/capabilities/geometry-guard/children/validate-click-point/implementation.ts",
		oldText: "import { createGeometryGuardChildCapability } from \"../../runtime/geometry-child-capability.js\";",
		newText: "import { BrowserController } from \"../../../lib/browser/browser-controller.js\";\nimport { createGeometryGuardChildCapability } from \"../../runtime/geometry-child-capability.js\";",
	},
	{
		kind: "replace",
		name: "child-returns-boolean",
		file: "src/capabilities/geometry-guard/children/validate-click-point/implementation.ts",
		oldText: "  return createGeometryGuardChildCapability(\"validate-click-point\");",
		newText: "  return true;",
	},
];

export const MUTATION_LAW_COVERAGE: Record<string, {
	coveredLawIds: string[];
	coverageReasonByLawId: Record<string, string>;
}> = {
	"manual-first-enforcement-reintroduced": {
		coveredLawIds: [LAW_IDS.ENFORCEMENT],
		coverageReasonByLawId: {
			[LAW_IDS.ENFORCEMENT]: "The mutation downgrades Geometry Guard enforcement to manual-first, proving the domain must remain machine-blocking with inspector, runner, and negative proof.",
		},
	},
	"forbidden-plan-coordinate-action-child": {
		coveredLawIds: [LAW_IDS.OWNER],
		coverageReasonByLawId: {
			[LAW_IDS.OWNER]: "The mutation adds a forbidden action-planning child to Geometry Guard, proving executable geometry safety ownership cannot expand into action planning.",
		},
	},
	"fallback-mode-result-escape": {
		coveredLawIds: [LAW_IDS.CONTRACT],
		coverageReasonByLawId: {
			[LAW_IDS.CONTRACT]: "The mutation leaks a forbidden fallbackMode field into Geometry Guard result output, proving the public contract must remain clean and geometry-native.",
		},
	},
	"remove-capabilityCallId-from-input": {
		coveredLawIds: [LAW_IDS.INPUT_CHAIN],
		coverageReasonByLawId: {
			[LAW_IDS.INPUT_CHAIN]: "The mutation removes a required input chain field, proving Geometry Guard input must preserve the governed execution chain.",
		},
	},
	"silent-clamp-introduced": {
		coveredLawIds: [LAW_IDS.COORDINATE],
		coverageReasonByLawId: {
			[LAW_IDS.COORDINATE]: "The mutation silently clamps geometry values, proving Geometry Guard coordinate normalization cannot guess or hide illegal geometry.",
		},
	},
	"child-returns-boolean": {
		coveredLawIds: [LAW_IDS.PIPELINE],
		coverageReasonByLawId: {
			[LAW_IDS.PIPELINE]: "The mutation bypasses the shared child pipeline by returning a boolean from a child implementation, proving Geometry Guard children must remain thin delegates into the governed executor.",
		},
	},
	"proof-runId-from-session-child": {
		coveredLawIds: [LAW_IDS.RESULT_PROOF],
		coverageReasonByLawId: {
			[LAW_IDS.RESULT_PROOF]: "The mutation fabricates a proof identity from local child data, proving Geometry Guard result and runtime proof must preserve real upstream chain truth.",
		},
	},
	"mouse-click-scale-mapping-remap": {
		coveredLawIds: [LAW_IDS.DOWNSTREAM],
		coverageReasonByLawId: {
			[LAW_IDS.DOWNSTREAM]: "The mutation makes Mouse Click remap scaleMapping downstream of Geometry Guard, proving downstream action groups cannot recompute executable geometry.",
		},
	},
};