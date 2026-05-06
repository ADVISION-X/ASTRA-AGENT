import { readFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";

import { LAW_IDS } from "./config.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
  expectedNeedle: string;
};

type ProofMutation = Mutation & {
  lawId: string;
  scenarioId: string;
  coverageReason: string;
};

type InspectorRunResult = {
  passed: boolean;
  violationCount: number;
  output: string;
};

type MutationRecord = {
  mutation: Mutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

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

async function createInspectorRunner(): Promise<() => Promise<InspectorRunResult>> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);

  return async () => {
    const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
    process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";
    try {
      const result = await inspector(context);
      return {
        passed: result.passed,
        violationCount: result.violationCount,
        output: [
          `classification: ${result.classification}`,
          `passed: ${result.passed}`,
          `violationCount: ${result.violationCount}`,
          `summary: ${result.summary}`,
          "",
          ...result.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
          "",
        ].join("\n"),
      };
    } finally {
      if (previous === undefined) {
        delete process.env[SKIP_NEGATIVE_PROOF_ENV];
      } else {
        process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
      }
    }
  };
}

async function verifyMutation(runInspector: () => Promise<InspectorRunResult>, mutation: Mutation): Promise<MutationRecord> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();
  await applyAuditMutation(filePath, state.original, mutation);
  const mutatedContent = await readFile(filePath, "utf8");
  let failOutput = "";

  try {
    const result = await runInspector();
    failOutput = result.output;
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
    if (!failOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed without the expected reason: ${mutation.expectedNeedle}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }

  return {
    mutation,
    originalContent: state.original,
    mutatedContent,
    failOutput,
    passOutput: restored.output,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function writeLawProof(record: MutationRecord, mutation: ProofMutation): Promise<void> {
  await writeProductionMutationProof({
    owner: "screenshot",
    ownerTitle: "Screenshot",
    mutationName: mutation.name,
    scenarioId: mutation.scenarioId,
    coveredLawIds: [mutation.lawId],
    coverageReasonByLawId: { [mutation.lawId]: mutation.coverageReason },
    mutatedFile: mutation.file,
    originalContent: record.originalContent,
    mutatedContent: record.mutatedContent,
    failOutput: record.failOutput,
    passOutput: record.passOutput,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
  });
}

async function writeOwnerBindingBundle(records: MutationRecord[]): Promise<void> {
  const scenarios = records.map((record) => ({
    scenario: record.mutation.name,
    outputFileName: `${record.mutation.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-fail.txt`,
    output: record.failOutput,
  }));
  await writeOwnerBindingProof({
    owner: "screenshot",
    title: "Screenshot",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
}

async function main(): Promise<void> {
  const runInspector = await createInspectorRunner();
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error(`Screenshot inspector baseline must pass before proof generation.\n${baseline.output}`);
  }

  for (const mutation of PROOF_MUTATIONS) {
    const record = await verifyMutation(runInspector, mutation);
    await writeLawProof(record, mutation);
  }

  const ownerBindingRecords: MutationRecord[] = [];
  for (const mutation of OWNER_BINDING_MUTATIONS) {
    ownerBindingRecords.push(await verifyMutation(runInspector, mutation));
  }
  await writeOwnerBindingBundle(ownerBindingRecords);

  process.stdout.write(`[SCREENSHOT-PROOF-BUNDLES] generated ${PROOF_MUTATIONS.length} law proofs and ${ownerBindingRecords.length} owner-binding scenarios\n`);
}

void main();