import {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle,
  writeOwnerBindingBundle,
  type AuditMutation,
  type MutationCoverage,
  type MutationProofRecord,
} from "../_shared/negative-proof-runtime.js";

import { LAW_IDS } from "./config.js";

type Mutation = AuditMutation & {
  expectedNeedle: string;
};

type ProofMutation = Mutation & {
  lawId: string;
  scenarioId: string;
  coverageReason: string;
};

type MutationRecord = MutationProofRecord<Mutation>;

const INSPECTOR_ENTRY = "scripts/audit/domains/screenshot-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF";

const OWNER_BINDING_MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md",
    mode: "replace",
    search: "enforcementMode: machine-blocking",
    replace: "enforcementMode: manual-first",
    expectedNeedle: "Screenshot active laws must remain machine-blocking.",
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md",
    mode: "replace",
    search: "tier: P0",
    replace: "tier: P1",
    expectedNeedle: "Screenshot active laws must remain P0.",
  },
  {
    name: "remove-negative-proof-invocation mutation",
    file: "scripts/audit/domains/screenshot-capability/inspector.ts",
    mode: "replace",
    search: "  : await runNegativeProofHarness();",
    replace: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
    expectedNeedle: "Screenshot inspector must invoke the negative-proof harness.",
  },
];

const PROOF_MUTATIONS: ProofMutation[] = [
  {
    name: "historical screenshot drawer resurrection mutation",
    file: "src/app/platform-action-screenshot-drawer-active-owner.ts",
    mode: "write",
    content: "export const screenshotDrawerOwner = true;\n",
    expectedNeedle: "Historical screenshot drawer path must remain deleted.",
    lawId: LAW_IDS.PUBLIC,
    scenarioId: "screenshot-historical-drawer-resurrection",
    coverageReason: "The mutation resurrects a historical screenshot drawer owner path, proving screenshot artifact truth remains exclusive to the Screenshot ability group.",
  },
  {
    name: "screenshot-imports-ai-runtime mutation",
    file: "src/capabilities/screenshot/runtime/ai-runtime-import-probe.ts",
    mode: "write",
    content: 'import "../../../capabilities/ai/ability-group.js";\nexport const probe = true;\n',
    expectedNeedle: "Screenshot owner must not cross the boundary into AI, mouse, geometry, forensics, or open internals.",
    lawId: LAW_IDS.BOUNDARY,
    scenarioId: "screenshot-imports-ai-runtime",
    coverageReason: "The mutation imports AI runtime code into the Screenshot owner, proving screenshot boundary stays pure and does not cross into AI ownership.",
  },
  {
    name: "nullable chain field regression mutation",
    file: "src/capabilities/screenshot/shared/screenshot-governance.ts",
    mode: "replace",
    search: "  capabilityCallId: limitedString(200),",
    replace: "  capabilityCallId: nullableLimitedString(200),",
    expectedNeedle: "Screenshot governance must preserve all 3 required occurrences of capabilityCallId: limitedString(200),.",
    lawId: LAW_IDS.SHAPE,
    scenarioId: "screenshot-nullable-capability-call-id",
    coverageReason: "The mutation weakens a required V2 chain field in screenshot governance, proving screenshot input truth must preserve hard-required chain fields.",
  },
  {
    name: "non-success output escape mutation",
    file: "src/capabilities/screenshot/schema.ts",
    mode: "replace",
    search: "non-success result must not expose output",
    replace: "non-success result may expose output",
    expectedNeedle: "Screenshot schema anti-escape rules for output and outputRef are missing.",
    lawId: LAW_IDS.SCHEMA,
    scenarioId: "screenshot-non-success-output-escape",
    coverageReason: "The mutation weakens non-success output invariants in the schema, proving screenshot result/proof parity must fail closed when output truth drifts.",
  },
  {
    name: "timeout truth bypass mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-execution-phase-helpers.ts",
    mode: "replace",
    search: "timeoutMs: resolveScreenshotTimeoutMs(input.request, input.registryEntry.maxDurationMs)",
    replace: "timeoutMs: input.registryEntry.maxDurationMs",
    expectedNeedle: "Screenshot phase helpers must route runtime timeout through resolveScreenshotTimeoutMs.",
    lawId: LAW_IDS.TIMEOUT,
    scenarioId: "screenshot-timeout-truth-bypass",
    coverageReason: "The mutation bypasses governed timeout resolution, proving screenshot timeout truth must route through the shared resolveScreenshotTimeoutMs helper.",
  },
  {
    name: "region crop flattening mutation",
    file: "src/capabilities/screenshot/registry.ts",
    mode: "replace",
    search: "    outputImageKind: \"region_crop\",\n    coordinateSpacePolicy: \"region_crop_pixels\",",
    replace: "    outputImageKind: \"evidence_original\",\n    coordinateSpacePolicy: \"source_image_pixels\",",
    expectedNeedle: "Screenshot registry must keep capture-region as region_crop/region_crop_pixels and optimize-lossless as derived coordinate truth.",
    lawId: LAW_IDS.TRANSFORM,
    scenarioId: "screenshot-region-crop-flattening",
    coverageReason: "The mutation collapses region-crop transform truth back to source-image coordinates, proving Screenshot must preserve governed transform image kinds and coordinate-space lineage.",
  },
  {
    name: "child boolean return mutation",
    file: "src/capabilities/screenshot/children/capture-browser-viewport/implementation.ts",
    mode: "replace",
    search: "    return CaptureBrowserViewportPlanSchema.parse({",
    replace: "    return true;\n    return CaptureBrowserViewportPlanSchema.parse({",
    expectedNeedle: "Screenshot child implementations must not return boolean shortcuts.",
    lawId: LAW_IDS.ENTRY,
    scenarioId: "screenshot-child-boolean-shortcut",
    coverageReason: "The mutation replaces a child plan return with a boolean shortcut, proving screenshot children must stay narrow and return governed runtime plans only.",
  },
  {
    name: "artifact lifecycle self-promotion mutation",
    file: "src/capabilities/screenshot/runtime/screenshot-artifact-lifecycle.ts",
    mode: "replace",
    search: "    promotionStatus: \"not_promoted\",\n",
    replace: "    promotionStatus: \"promoted\",\n",
    expectedNeedle: "Screenshot lifecycle runtime must resolve retention, default non-promotion, TTL, and artifact budget checks.",
    lawId: LAW_IDS.LIFECYCLE,
    scenarioId: "screenshot-lifecycle-self-promotion",
    coverageReason: "The mutation self-promotes screenshot artifacts inside lifecycle runtime, proving lifecycle truth must default to non-promotion until governed retention checks succeed.",
  },
  {
    name: "remove-negative-proof-invocation mutation",
    file: "scripts/audit/domains/screenshot-capability/inspector.ts",
    mode: "replace",
    search: "  : await runNegativeProofHarness();",
    replace: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
    expectedNeedle: "Screenshot inspector must invoke the negative-proof harness.",
    lawId: LAW_IDS.NEGATIVE_PROOF,
    scenarioId: "screenshot-negative-proof-removed",
    coverageReason: "The mutation removes Screenshot's negative-proof invocation from the owner inspector, proving enforcement must remain inspector-wired and negative-proof-backed.",
  },
];

const PROOF_MUTATION_COVERAGE: Record<string, MutationCoverage> = Object.fromEntries(
  PROOF_MUTATIONS.map((mutation) => [
    mutation.name,
    {
      coveredLawIds: [mutation.lawId],
      coverageReasonByLawId: {
        [mutation.lawId]: mutation.coverageReason,
      },
    },
  ]),
);

const PROOF_MUTATION_SCENARIO_IDS: Record<string, string> = Object.fromEntries(
  PROOF_MUTATIONS.map((mutation) => [mutation.name, mutation.scenarioId]),
);

async function verifyMutation(
  runInspector: Awaited<ReturnType<typeof createInspectorRunner>>,
  mutation: Mutation,
): Promise<MutationRecord> {
  const record = await mutateAndVerify(runInspector, mutation);
  if (!record.failOutput.includes(mutation.expectedNeedle)) {
    throw new Error(`Mutation ${mutation.name} failed without the expected reason: ${mutation.expectedNeedle}`);
  }
  return record;
}

async function writeLawProof(record: MutationRecord): Promise<void> {
  await writeMutationProofBundle({
    owner: "screenshot",
    ownerTitle: "Screenshot",
    record,
    coverageByMutationName: PROOF_MUTATION_COVERAGE,
    scenarioIdByMutationName: PROOF_MUTATION_SCENARIO_IDS,
  });
}

async function main(): Promise<void> {
  const runInspector = await createInspectorRunner({
    inspectorEntry: INSPECTOR_ENTRY,
    skipNegativeProofEnv: SKIP_NEGATIVE_PROOF_ENV,
  });
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error(`Screenshot inspector baseline must pass before proof generation.\n${baseline.output}`);
  }

  for (const mutation of PROOF_MUTATIONS) {
    const record = await verifyMutation(runInspector, mutation);
    await writeLawProof(record);
  }

  const ownerBindingRecords: MutationRecord[] = [];
  for (const mutation of OWNER_BINDING_MUTATIONS) {
    ownerBindingRecords.push(await verifyMutation(runInspector, mutation));
  }
  await writeOwnerBindingBundle({
    owner: "screenshot",
    title: "Screenshot",
    ownerBindingMutationNames: OWNER_BINDING_MUTATIONS.map((mutation) => mutation.name),
    records: ownerBindingRecords,
  });

  process.stdout.write(`[SCREENSHOT-PROOF-BUNDLES] generated ${PROOF_MUTATIONS.length} law proofs and ${ownerBindingRecords.length} owner-binding scenarios\n`);
}

void main();