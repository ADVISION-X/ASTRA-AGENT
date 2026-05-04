import { spawnSync } from "node:child_process";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/page-state-capability/inspector.ts";
const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/page-state-capability/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF";

type ReplaceMutation = {
  kind: "replace";
  name: string;
  file: string;
  oldText: string;
  newText: string;
  expectedNeedle: string;
};

type CreateFileMutation = {
  kind: "create-file";
  name: string;
  file: string;
  content: string;
  expectedNeedle: string;
};

type NegativeProofMutation = ReplaceMutation | CreateFileMutation;

const PAGE_STATE_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    kind: "replace",
    name: "manual-first-enforcement-reintroduced",
    file: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: page-state-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P0  \ncapabilityDomain: page-state-capability  \nenforcementMode: manual-first  \nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "machine-blocking",
  },
  {
    kind: "replace",
    name: "turn-p0-into-warning-only",
    file: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: page-state-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P1  \ncapabilityDomain: page-state-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "must remain P0",
  },
  {
    kind: "create-file",
    name: "open-feed-ready-classifier-outside-page-state",
    file: "src/capabilities/open/runtime/page-state-feed-ready-classifier-probe.ts",
    content: "export const feedReadyClassifier = () => \"feed_ready\";\n",
    expectedNeedle: "truth classifiers or truth helpers",
  },
  {
    kind: "create-file",
    name: "platform-login-wall-truth-helper-outside-page-state",
    file: "src/lib/browser/page-state-login-wall-truth-helper.ts",
    content: "export const loginWallTruthHelper = () => \"login_required\";\n",
    expectedNeedle: "truth classifiers or truth helpers",
  },
  {
    kind: "replace",
    name: "accept-action-completion-as-page-state-proof",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "    kind: z.literal(\"post_action_verification\"),",
    newText: "    kind: z.literal(\"action_completion\"),",
    expectedNeedle: "action completion as governed page-state proof",
  },
  {
    kind: "replace",
    name: "remove-capabilityCallId-from-input",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  capabilityCallId: z.string().min(1),",
    newText: "  capabilityCallIdRemoved: z.string().min(1),",
    expectedNeedle: "must include capabilityCallId",
  },
  {
    kind: "replace",
    name: "remove-activationSnapshotRef-from-input",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  activationSnapshotRef: z.string().min(1),",
    newText: "  activationSnapshotRefRemoved: z.string().min(1),",
    expectedNeedle: "must include activationSnapshotRef",
  },
  {
    kind: "replace",
    name: "remove-nerveBusEnvelopeId-from-input",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  nerveBusEnvelopeId: z.string().min(1),",
    newText: "  nerveBusEnvelopeIdRemoved: z.string().min(1),",
    expectedNeedle: "must include nerveBusEnvelopeId",
  },
  {
    kind: "replace",
    name: "remove-snapshot-sourceProofRef",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  sourceChildCapabilityId: z.string().min(1),\n  sourceProofRef: z.string().min(1),\n});\n\nconst PageStateFreshnessPolicySchema = z.object({",
    newText: "  sourceChildCapabilityId: z.string().min(1),\n});\n\nconst PageStateFreshnessPolicySchema = z.object({",
    expectedNeedle: "PageStateSnapshotSchema must include sourceProofRef",
  },
  {
    kind: "replace",
    name: "observation-without-sourceProofRef",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "    sourceChildCapabilityId: z.string().min(1),\n    sourceProofRef: z.string().min(1),\n    payload: RuntimeSignalObservationPayloadSchema,",
    newText: "    sourceChildCapabilityId: z.string().min(1),\n    payload: RuntimeSignalObservationPayloadSchema,",
    expectedNeedle: "sourceProofRef on snapshot and every governed observation shape",
  },
  {
    kind: "replace",
    name: "success-without-evidenceRefs",
    file: "src/capabilities/page-state/page-state-schema-validation.ts",
    oldText: "    addIssue(ctx, [\"evidenceRefs\"], \"success result must retain evidenceRefs\");",
    newText: "    // evidenceRefs requirement removed by mutation",
    expectedNeedle: "evidence backing",
  },
  {
    kind: "replace",
    name: "result-adds-verificationDecision",
    file: "src/capabilities/page-state/runtime/page-state-result-builder.ts",
    oldText: "    runtimeProof: input.runtimeProof,",
    newText: "    verificationDecision: \"verified\",\n    runtimeProof: input.runtimeProof,",
    expectedNeedle: "post-action verification truth fields",
  },
  {
    kind: "replace",
    name: "failed-result-retains-output",
    file: "src/capabilities/page-state/page-state-schema-validation.ts",
    oldText: "    addIssue(ctx, [\"output\"], \"failed or review_required result must null output\");",
    newText: "    addIssue(ctx, [\"output\"], \"failed or review_required result may retain output\");",
    expectedNeedle: "must forbid non-null output or outputRef",
  },
  {
    kind: "replace",
    name: "proof-runId-from-fingerprint",
    file: "src/capabilities/page-state/runtime/page-state-proof-builder.ts",
    oldText: "    runId: input.request.runId,",
    newText: "    runId: input.pageStateFingerprint,",
    expectedNeedle: "must propagate input.request.runId",
  },
  {
    kind: "replace",
    name: "proof-missing-activationSnapshotRef",
    file: "src/capabilities/page-state/runtime/page-state-proof-builder.ts",
    oldText: "    activationSnapshotRef: input.request.activationSnapshotRef,",
    newText: "    activationSnapshotRef: null,",
    expectedNeedle: "must propagate input.request.activationSnapshotRef",
  },
  {
    kind: "replace",
    name: "child-imports-screenshot-implementation",
    file: "src/capabilities/page-state/children/detect-login-state/implementation.ts",
    oldText: "import type { DetectLoginStateChildCapability } from \"./contract.js\";",
    newText: "import type { DetectLoginStateChildCapability } from \"./contract.js\";\nimport { createScreenshotAbilityGroup } from \"../../../screenshot/index.js\";",
    expectedNeedle: "must not import forbidden capability implementations",
  },
  {
    kind: "replace",
    name: "child-returns-boolean",
    file: "src/capabilities/page-state/children/detect-login-state/implementation.ts",
    oldText: "      return DetectLoginStateChildOutputSchema.parse(buildLoginStateOutput(request));",
    newText: "      return true as never;",
    expectedNeedle: "ChildOutputSchema.parse boundary",
  },
  {
    kind: "replace",
    name: "child-hardcodes-tiktok-feed-path",
    file: "src/capabilities/page-state/children/detect-feed-ready/implementation.ts",
    oldText: "  if (resolvedProfile && hasFeedEvidence && urlMatchesFeedPath(request.snapshot.currentUrl, resolvedProfile)) {",
    newText: "  if (resolvedProfile && hasFeedEvidence && request.snapshot.currentUrl.includes(\"/foryou\")) {",
    expectedNeedle: "hardcode TikTok-only paths",
  },
  {
    kind: "create-file",
    name: "external-import-of-child-implementation",
    file: "src/app/page-state-private-import-probe.ts",
    content: 'import "../capabilities/page-state/children/detect-login-state/implementation.js";\nexport const probe = true;\n',
    expectedNeedle: "must not import page-state runtime or child internals",
  },
  {
    kind: "create-file",
    name: "add-verify-page-state-capabilities",
    file: "src/capabilities/page-state/verify-page-state-capabilities.ts",
    content: "export const verifyPageStateCapabilities = true;\n",
    expectedNeedle: "must not add verify/capability-check side paths",
  },
  {
    kind: "replace",
    name: "remove-negative-proof-invocation",
    file: "scripts/audit/domains/page-state-capability/inspector.ts",
    oldText: "    : await runNegativeProofHarness();",
    newText: "      : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } };",
    expectedNeedle: "must invoke and report the negative-proof harness",
  },
];

function runInspectorProcess(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: {
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function applyMutationOnce(source: string, mutation: ReplaceMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

async function doesFileExist(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function applyMutation(mutation: NegativeProofMutation): Promise<() => Promise<void>> {
  const absolutePath = pathFromRepoRoot(mutation.file);

  if (mutation.kind === "replace") {
    const originalContent = await readFile(absolutePath, "utf8");
    const mutatedContent = applyMutationOnce(originalContent, mutation);
    await writeFile(absolutePath, mutatedContent, "utf8");
    return async () => {
      await writeFile(absolutePath, originalContent, "utf8");
    };
  }

  const fileExisted = await doesFileExist(absolutePath);
  if (fileExisted) {
    throw new Error(`Create-file mutation ${mutation.name} expected ${mutation.file} to be absent before mutation.`);
  }

  await writeFile(absolutePath, mutation.content, "utf8");
  return async () => {
    await unlink(absolutePath);
  };
}

async function mutateAndVerify(mutation: NegativeProofMutation): Promise<string> {
  const rollback = await applyMutation(mutation);
  try {
    const failRun = runInspectorProcess();
    const combinedOutput = `${failRun.stdout}\n${failRun.stderr}`;
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    if (!combinedOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed, but not for the expected reason. Missing needle: ${mutation.expectedNeedle}`);
    }
  } finally {
    await rollback();
  }

  const rollbackRun = runInspectorProcess();
  if (rollbackRun.status !== 0) {
    throw new Error(`Mutation ${mutation.name} did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
  }

  return `${mutation.name}: fail-ok rollback-ok`;
}

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
        lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = runInspectorProcess();
    if (baseline.status !== 0) {
      return createFatalResult(
        "Page State inspector baseline must pass before negative-proof mutation checks.",
        "Page State negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const reports: string[] = [];
    for (const mutation of PAGE_STATE_NEGATIVE_PROOF_MUTATIONS) {
      reports.push(await mutateAndVerify(mutation));
    }

    return createPassResult(`Page State negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Page State negative-proof harness failed.",
      "Page State negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}

async function main(): Promise<void> {
  const result = await runNegativeProofHarness();
  process.stdout.write(`[PAGE-STATE-NEGATIVE-PROOF] ${result.phase.summary}\n`);
  if (!result.phase.passed || result.findings.length > 0) {
    for (const finding of result.findings) {
      process.stdout.write(`- ${finding.message}\n`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void main();
}