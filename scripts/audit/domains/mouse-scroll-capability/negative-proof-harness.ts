import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle,
  writeOwnerBindingBundle,
  type AuditMutation,
  type InspectorRunner,
  type MutationCoverage,
  type MutationProofRecord,
} from "../_shared/negative-proof-runtime.js";

import { LAW_IDS as BASE_LAW_IDS } from "./config.js";

type Mutation = AuditMutation;

const INSPECTOR_ENTRY = "scripts/audit/domains/mouse-scroll-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF";
const OWNER_BINDING_MUTATION_NAMES = [
  "manual-first-enforcement mutation",
  "warning-only-p0 mutation",
  "workbench composition drift mutation",
] as const;
const LAW_IDS = {
  EXECUTION: BASE_LAW_IDS.EXECUTION,
  BOUNDARY: BASE_LAW_IDS.BOUNDARY,
  SCHEMA: BASE_LAW_IDS.SCHEMA,
  SCROLL_POLICY: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2",
  PIPELINE: BASE_LAW_IDS.TIMING,
  RESULT: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2",
  PROOF: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2",
  CHILDREN: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2",
  ENFORCEMENT: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2",
} as const;

const MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: mouse-scroll-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: mouse-scroll-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: mouse-scroll-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: mouse-scroll-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "browser-controller-public-contract mutation",
    file: "src/capabilities/mouse-scroll/contract.ts",
    search: "import type { z } from \"zod\";",
    replace: "import type { z } from \"zod\";\nimport type { BrowserController } from \"../../lib/browser/browser-controller.js\";",
  },
  {
    name: "platform-direct-scroll mutation",
    file: "src/lib/local-runtime/workbench-mouse-scroll-runtime.ts",
    search: "  mouseScrollAbilityGroup: createWorkbenchMouseScrollAbilityGroup({",
    replace: "  platformScrollStrategy: runtime.browserController.scroll({ targetLabel: \"mutated\", deltaX: 0, deltaY: 120, coordinateSpace: \"browser-viewport\", anchorPoint: { x: 0, y: 0 }, fallbackUsed: false }),\n  mouseScrollAbilityGroup: createWorkbenchMouseScrollAbilityGroup({",
  },
  {
    name: "mouse-scroll-final-action-log mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts",
    search: "    runtimeProof,",
    replace: "    runtimeProof,\n    actionLogRef: input.seed.attemptRef,",
  },
  {
    name: "result output null guard mutation",
    file: "src/capabilities/mouse-scroll/schema.ts",
    search: 'message: "failed and review_required require output=null"',
    replace: 'message: "mutated output null guard removed"',
  },
  {
    name: "platform-business-verb-child mutation",
    file: "src/capabilities/mouse-scroll/registry.ts",
    search: "  createScrollRegionCapability(),",
    replace: "  createScrollRegionCapability(),\n  \"scroll-next-video\" as never,",
  },
  {
    name: "scale-mapping mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-validator.ts",
    search: "  const deltaResolution = validateDeltaResolution(input, seed, safetyGate.value);",
    replace: "  const scaleMapping = true;\n  const deltaResolution = validateDeltaResolution(input, seed, safetyGate.value);",
  },
  {
    name: "scroll-until-found loop mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-executor.ts",
    search: "  const validated = validateMouseScrollExecution(input);",
    replace: "  while (input.request.purpose === \"scroll_until_found\") { break; }\n  const validated = validateMouseScrollExecution(input);",
  },
  {
    name: "browser-action-id leakage mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts",
    search: "    runtimeProof,",
    replace: "    runtimeProof,\n    BrowserActionId: input.primitiveCallId,",
  },
  {
    name: "quartz-wheel-polarity mutation",
    file: "src/lib/browser/current-chrome-browser-controller-primitives.ts",
    search: "const toQuartzWheelDelta = (value: number): number => -Math.round(value);",
    replace: "const toQuartzWheelDelta = (value: number): number => Math.round(value);",
  },
  {
    name: "pav-decision-field mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts",
    search: "    runtimeProof,",
    replace: "    runtimeProof,\n    postActionVerificationDecision: input.status === \"success\" ? \"verified\" : \"skipped\",",
  },
  {
    name: "export-star escape mutation",
    file: "src/capabilities/mouse-scroll/index.ts",
    search: 'export { listMouseScrollChildren } from "./registry.js";',
    replace: 'export { listMouseScrollChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "policy gate bypass mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-validator.ts",
    search: "  const policyGate = validatePolicyGate(input, seed);",
    replace: "  const policyDecision = validatePolicyGate(input, seed);",
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts",
    search: "  const runtimeProof = buildMouseScrollRuntimeProofForResult(input, outputRef, postActionVerificationHandoffRef);",
    replace: "  const proofRemoved = buildMouseScrollRuntimeProofForResult(input, outputRef, postActionVerificationHandoffRef);",
  },
  {
    name: "timeout abort removal mutation",
    file: "src/capabilities/mouse-scroll/runtime/primitive-scroll-port-call.ts",
    search: "    input.abortController.abort(new Error(`Mouse Scroll primitive timed out after ${input.input.timeoutMs}ms.`));",
    replace: "    void input.input.timeoutMs;",
  },
  {
    name: "computed scroll escape mutation",
    file: "src/capabilities/mouse-scroll/runtime/primitive-scroll-port-call.ts",
    search: "  return input.input.context.primitivePort.scroll({",
    replace: '  return input.input.context.primitivePort["scroll"]({',
  },
  {
    name: "workbench composition drift mutation",
    file: "src/lib/local-runtime/workbench-mouse-scroll-ability-group.ts",
    search: ") => createMouseScrollAbilityGroupWithPrimitivePort(...input);",
    replace: ") => input[0] as never;",
  },
];

const MUTATION_LAW_COVERAGE: Record<string, MutationCoverage> = {
  "manual-first-enforcement mutation": {
    coveredLawIds: [LAW_IDS.ENFORCEMENT],
    coverageReasonByLawId: {
      [LAW_IDS.ENFORCEMENT]: "The mutation downgrades Mouse Scroll enforcement to manual-first, proving this domain must close through machine-blocking inspector, runner, and negative proof.",
    },
  },
  "platform-direct-scroll mutation": {
    coveredLawIds: [LAW_IDS.EXECUTION],
    coverageReasonByLawId: {
      [LAW_IDS.EXECUTION]: "The mutation lets the workbench runtime invoke a primitive scroll directly, proving governed scroll execution truth remains owned by Mouse Scroll.",
    },
  },
  "mouse-scroll-final-action-log mutation": {
    coveredLawIds: [LAW_IDS.BOUNDARY, LAW_IDS.RESULT],
    coverageReasonByLawId: {
      [LAW_IDS.BOUNDARY]: "The mutation leaks final action-log ownership into Mouse Scroll result building, proving Mouse Scroll cannot perform foreign-owner work.",
      [LAW_IDS.RESULT]: "The mutation adds final action-log truth to the Mouse Scroll result, proving result success must remain limited to primitive scroll plus PAV handoff.",
    },
  },
  "result output null guard mutation": {
    coveredLawIds: [LAW_IDS.SCHEMA],
    coverageReasonByLawId: {
      [LAW_IDS.SCHEMA]: "The mutation removes the schema-level output=null guard for failed and review_required results, proving Mouse Scroll schema must preserve its governed result invariants.",
    },
  },
  "scroll-until-found loop mutation": {
    coveredLawIds: [LAW_IDS.SCROLL_POLICY],
    coverageReasonByLawId: {
      [LAW_IDS.SCROLL_POLICY]: "The mutation introduces a hidden until-found loop, proving direction, magnitude, and repeat must stay explicit input or policy rather than hidden runtime behavior.",
    },
  },
  "policy gate bypass mutation": {
    coveredLawIds: [LAW_IDS.PIPELINE],
    coverageReasonByLawId: {
      [LAW_IDS.PIPELINE]: "The mutation bypasses the governed scroll policy gate, proving Mouse Scroll must keep its fixed execution pipeline intact before primitive scroll execution.",
    },
  },
  "proof drop mutation": {
    coveredLawIds: [LAW_IDS.PROOF],
    coverageReasonByLawId: {
      [LAW_IDS.PROOF]: "The mutation drops the runtime proof from Mouse Scroll result assembly, proving result and runtime proof must preserve the real upstream chain.",
    },
  },
  "platform-business-verb-child mutation": {
    coveredLawIds: [LAW_IDS.CHILDREN],
    coverageReasonByLawId: {
      [LAW_IDS.CHILDREN]: "The mutation injects a platform business verb into the Mouse Scroll child registry, proving children must remain narrow primitive bindings only.",
    },
  },
  "quartz-wheel-polarity mutation": {
    coveredLawIds: [LAW_IDS.EXECUTION],
    coverageReasonByLawId: {
      [LAW_IDS.EXECUTION]: "The mutation removes browser-to-Quartz wheel polarity conversion, proving production scroll must advance the visible feed instead of replaying the current video.",
    },
  },
};

function createPassResult(summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [],
    phase: createPhase("negative-proof-harness", "PASS", true, summary),
  };
}

function createFatalResult(message: string, summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [
      createFinding({
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(runInspectorOnce: InspectorRunner): Promise<MutationProofRecord[]> {
  const records: MutationProofRecord[] = [];
  for (const mutation of MUTATIONS) {
    const record = await mutateAndVerify(runInspectorOnce, mutation);
    records.push(record);
    await writeMutationProofBundle({
      owner: "mouse-scroll",
      ownerTitle: "Mouse Scroll",
      record,
      coverageByMutationName: MUTATION_LAW_COVERAGE,
    });
  }

  await writeOwnerBindingBundle({
    owner: "mouse-scroll",
    title: "Mouse Scroll",
    ownerBindingMutationNames: OWNER_BINDING_MUTATION_NAMES,
    records,
  });
  return records;
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const runInspectorOnce = await createInspectorRunner({
      inspectorEntry: INSPECTOR_ENTRY,
      skipNegativeProofEnv: SKIP_NEGATIVE_PROOF_ENV,
    });
    const baseline = await runInspectorOnce();
    if (!baseline.passed) {
      return createFatalResult(
        "Mouse Scroll inspector baseline must pass before negative-proof mutation checks.",
        "Mouse Scroll negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspectorOnce);

    return createPassResult("Mouse Scroll negative-proof harness rejects baseline drift, BrowserController public-contract leaks, platform direct scroll ownership, final action-log leakage, platform business-verb child drift, scale-mapping drift, scroll-until-found loops, BrowserAction result leakage, post-action verification decision leakage, gate bypass, proof drop, timeout abort escape, computed scroll, and composition drift mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Mouse Scroll negative-proof harness failed.",
      "Mouse Scroll negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
