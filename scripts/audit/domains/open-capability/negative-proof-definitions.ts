import { openInspectionConstants as config } from "./inspection-constants.js";

export type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  skipBuild?: boolean;
};

const EXPORT_STAR_MUTATION = `export ${"*"} from "./schema.js";`;

export const MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: open-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: open-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
    skipBuild: true,
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: open-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: open-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    skipBuild: true,
  },
  {
    name: "request chain mutation",
    file: "src/capabilities/open/schema-core.ts",
    search: "  stepId: z.string().min(1),",
    replace: "  // mutated stepId removed,",
  },
  {
    name: "result diagnostic mutation",
    file: "src/capabilities/open/schema-proof.ts",
    search: "  diagnosticPayloadRef: nullableString,\n  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),\n  runtimeProof: OpenRuntimeProofSchema,",
    replace: "  // mutated diagnosticPayloadRef removed,\n  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),\n  runtimeProof: OpenRuntimeProofSchema,",
  },
  {
    name: "proof browser-session mutation",
    file: "src/capabilities/open/schema-proof.ts",
    search: "  browserSessionRef: nullableString,",
    replace: "  // mutated browserSessionRef removed,",
  },
  {
    name: "proof chain mutation",
    file: "src/capabilities/open/runtime/open-proof-builder.ts",
    search: "  capabilityCallId: request.capabilityCallId,",
    replace: "  // mutated capabilityCallId removed,",
  },
  {
    name: "dispatch shape-hash mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure-builders.ts",
    search: '  receivedShapeHash: input.trace.parseDecision === "fallback_trace_only" ? input.trace.receivedShapeHash : null,',
    replace: "  receivedShapeHash: null,",
  },
  {
    name: "success handoff mutation",
    file: "src/capabilities/open/runtime/open-result-builder.ts",
    search: "    pageStateHandoffRef,\n    pageStateHandoffRequired: true,",
    replace: "    pageStateHandoffRequired: true,",
  },
  {
    name: "timeout abort mutation",
    file: "src/capabilities/open/runtime/navigation-runner-support.ts",
    search: "      abortSignal: abortController.signal,",
    replace: "      // mutated abortSignal removed,",
  },
  {
    name: "idempotency fail-open mutation",
    file: "src/capabilities/open/runtime/open-idempotency.ts",
    search: "    return buildDuplicateReviewRequiredReservation(idempotencyKey);",
    replace: "    return buildReservedReservation(idempotencyKey);",
  },
  {
    name: "dispatch fake allow mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure-builders.ts",
    search: "const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({\n  status: \"block\" as const,",
    replace: "const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({\n  status: \"allow\" as const,",
  },
  {
    name: "export star mutation",
    file: "src/capabilities/open/index.ts",
    search: 'export type { OpenBrowserPort } from "./ports/open-browser-port.js";',
    replace: `export type { OpenBrowserPort } from "./ports/open-browser-port.js";\n${EXPORT_STAR_MUTATION}`,
  },
  {
    name: "forbidden import mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: 'import { executeOpenChildFlow } from "./open-executor-flow.js";',
    replace: 'import { executeOpenChildFlow } from "./open-executor-flow.js";\nimport type { ScreenshotAbilityGroup } from "../../screenshot/contract.js";',
  },
  {
    name: "external private-leak mutation",
    file: "src/lib/local-runtime/workbench-open-runtime.ts",
    search: 'import { createOpenAbilityGroup } from "../../capabilities/open/index.js";',
    replace: 'import { createOpenAbilityGroup } from "../../capabilities/open/index.js";\nimport { executeOpenChild } from "../../capabilities/open/runtime/open-executor.js";\nvoid executeOpenChild;',
  },
  {
    name: "remove open-local-program child mutation",
    file: "src/capabilities/open/shared/open-target-profile.ts",
    search: '  "open-local-program",',
    replace: "  // mutated open-local-program removed,",
  },
  {
    name: "remove macos-local platform mutation",
    file: "src/capabilities/open/shared/open-target-profile.ts",
    search: '  "macos-local",',
    replace: "  // mutated macos-local removed,",
  },
  {
    name: "remove local-program target kind mutation",
    file: "src/capabilities/open/shared/open-target-profile.ts",
    search: '  "local-program",',
    replace: "  // mutated local-program removed,",
  },
  {
    name: "registry local-program fake localhost mutation",
    file: "src/capabilities/open/registry.ts",
    search: '    targetProfileRef: OPEN_LOCAL_PROGRAM_TARGET_PROFILE_REF,',
    replace: '    allowedHostnames: ["localhost"],\n    defaultUrl: "http://127.0.0.1:3000",\n    allowedSchemes: ["http"],\n    targetProfileRef: OPEN_LOCAL_PROGRAM_TARGET_PROFILE_REF,',
  },
  {
    name: "local-program child raw shell mutation",
    file: "src/capabilities/open/children/open-local-program/implementation.ts",
    search: 'import { executeOpenChild } from "../../runtime/open-executor.js";',
    replace: 'import { executeOpenChild } from "../../runtime/open-executor.js";\nimport { spawn } from "node:child_process";\nvoid spawn;',
  },
  {
    name: "local-program missing window handoff proof mutation",
    file: "src/capabilities/open/runtime/local-program-completion.ts",
    search: "windowHandoffRef: handoff.windowHandoffRef, localAppStateHandoffRef: handoff.localAppStateHandoffRef, localProgramSnapshotAvailable",
    replace: "windowHandoffRef: null, localAppStateHandoffRef: handoff.localAppStateHandoffRef, localProgramSnapshotAvailable",
  },
  {
    name: "local-program missing local app state handoff proof mutation",
    file: "src/capabilities/open/runtime/local-program-completion.ts",
    search: "windowHandoffRef: handoff.windowHandoffRef, localAppStateHandoffRef: handoff.localAppStateHandoffRef, localProgramSnapshotAvailable",
    replace: "windowHandoffRef: handoff.windowHandoffRef, localAppStateHandoffRef: null, localProgramSnapshotAvailable",
  },
  {
    name: "remove OpenLocalProgramPort adapter injection mutation",
    file: "src/lib/local-runtime/workbench-open-runtime.ts",
    search: "    localProgram: createGovernedMacOSOpenLocalProgramAdapter(),\n",
    replace: "",
  },
  {
    name: "remove local-program readiness block mutation",
    file: "src/lib/local-runtime/workbench-status.ts",
    search: "BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED",
    replace: "MUTATED_NO_LOCAL_PROGRAM_READINESS_BLOCK",
  },
  {
    name: "local-program adapter raw shell mutation",
    file: "src/lib/local-runtime/open-local-program-adapter-system.ts",
    search: "shell: false",
    replace: "shell: true",
  },
  {
    name: "catalog omits open-local-program supported targets mutation",
    file: "src/map-plugins/authoring/capability-catalog/builders/build-ai-open-entries.ts",
    search: '["macos-local", "local-program-window", "desktop-screen"]',
    replace: '["macos-local"]',
  },
  {
    name: "map workbench local-program confusion mutation",
    file: "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json",
    search: '"childCapabilityId": "open-local-program",',
    replace: '"childCapabilityId": "open-local-workbench", "targetKind": "local-program",',
  },
  {
    name: "debug-loop direct local app launch mutation",
    file: "scripts/debug-loop/run-debug-loop.mjs",
    search: "import",
    replace: "const shellCommand = 'open -a iPhone Mirroring';\nvoid shellCommand;\nimport",
  },
];

export const OWNER_BINDING_MUTATION_NAMES = [
  "manual-first-enforcement mutation",
  "warning-only-p0 mutation",
  "external private-leak mutation",
] as const;

export const MUTATION_LAW_COVERAGE: Record<string, {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
}> = {
  "manual-first-enforcement mutation": {
    coveredLawIds: [config.LAW_ENFORCEMENT],
    coverageReasonByLawId: {
      [config.LAW_ENFORCEMENT]: "The mutation downgrades Open active law enforcement to manual-first, proving enforcement must remain machine-blocking and negative-proof backed.",
    },
  },
  "external private-leak mutation": {
    coveredLawIds: [config.LAW_PUBLIC_CONTRACT],
    coverageReasonByLawId: {
      [config.LAW_PUBLIC_CONTRACT]: "The mutation lets external runtime code import a private Open executor surface, proving governed open behavior must remain owned by the Open Ability Group public contract.",
    },
  },
  "forbidden import mutation": {
    coveredLawIds: [config.LAW_BOUNDARY],
    coverageReasonByLawId: {
      [config.LAW_BOUNDARY]: "The mutation imports screenshot capability types into Open runtime, proving Open boundary must stay pure and must not own screenshot, AI, or action truth.",
    },
  },
  "request chain mutation": {
    coveredLawIds: [config.LAW_INPUT_CHAIN],
    coverageReasonByLawId: {
      [config.LAW_INPUT_CHAIN]: "The mutation removes required step chain data from Open schema, proving every Open request must preserve the governed mission/map/step chain.",
    },
  },
  "timeout abort mutation": {
    coveredLawIds: [config.LAW_RUNTIME_GOVERNANCE],
    coverageReasonByLawId: {
      [config.LAW_RUNTIME_GOVERNANCE]: "The mutation bypasses abort handling in navigation runner support, proving Open runtime governance must enforce timeout and cancellation behavior.",
    },
  },
  "success handoff mutation": {
    coveredLawIds: [config.LAW_PAGE_STATE_HANDOFF],
    coverageReasonByLawId: {
      [config.LAW_PAGE_STATE_HANDOFF]: "The mutation drops page-state handoff ref construction from Open success results, proving Open success cannot exist without governed page-state handoff.",
    },
  },
  "proof chain mutation": {
    coveredLawIds: [config.LAW_RESULT_PROOF],
    coverageReasonByLawId: {
      [config.LAW_RESULT_PROOF]: "The mutation removes capabilityCallId from Open runtime proof construction, proving Open result and proof must preserve real chain and browser-session truth.",
    },
  },
  "export star mutation": {
    coveredLawIds: [config.LAW_PACKAGE_SHAPE],
    coverageReasonByLawId: {
      [config.LAW_PACKAGE_SHAPE]: "The mutation reintroduces export-star on the Open package root, proving package shape must stay canonical and explicit.",
    },
  },
  "warning-only-p0 mutation": {
    coveredLawIds: [config.LAW_ENFORCEMENT],
    coverageReasonByLawId: {
      [config.LAW_ENFORCEMENT]: "The mutation downgrades Open active law severity from P0 to warning-only, proving enforcement must remain machine-blocking and negative-proof backed.",
    },
  },
  "remove macos-local platform mutation": {
    coveredLawIds: [config.LAW_LOCAL_PROGRAM],
    coverageReasonByLawId: {
      [config.LAW_LOCAL_PROGRAM]: "The mutation removes the macOS local-program platform from Open target profile support, proving the governed local-program path must remain present and complete.",
    },
  },
};
