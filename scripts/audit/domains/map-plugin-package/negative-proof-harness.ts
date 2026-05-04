import { spawn } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { AUTHORING_INPUT_PACKAGE_MUTATIONS } from "./authoring-input-package-negative-proof.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { LAW_FILE: MAP_PLUGIN_LAW_FILE } = MAP_PLUGIN_PATHS;

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/map-plugin-package/inspector.ts";
const INSPECTOR_RUNNER = "scripts/audit/domains/map-plugin-package/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  ...AUTHORING_INPUT_PACKAGE_MUTATIONS,
  {
    name: "manual-first law regression mutation",
    file: MAP_PLUGIN_LAW_FILE,
    search: "## Law GRASSEYE-MAP-PLUGIN-001-V2\n\nstatus: active  \ntier: P0  \ncapabilityDomain: map-plugin-package  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    replace: "## Law GRASSEYE-MAP-PLUGIN-001-V2\n\nstatus: active  \ntier: P1  \ncapabilityDomain: map-plugin-package  \nenforcementMode: manual-first  \nevidenceMode: law",
  },
  {
    name: "map package modeled as child ability mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '    "packageKind": "operational-map-package",\n',
    replace: '    "packageKind": "child-capability-package",\n',
  },
  {
    name: "map package raw prompt mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '  "signature": null\n',
    replace: '  "rawPrompt": "Do the platform action directly.",\n  "signature": null\n',
  },
  {
    name: "map package functionBody mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '  "signature": null\n',
    replace: '  "functionBody": "return \"mutated\";",\n  "signature": null\n',
  },
  {
    name: "map package eval string mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '  "changelog": "Initial built-in product discovery map package.",\n',
    replace: '  "changelog": "eval(1)",\n',
  },
  {
    name: "legacy branch dsl mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "source": "decision", "equals": "product_yes" }',
  },
  {
    name: "branch undeclared field mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '{ "conditionType": "comparison", "leftRef": "decision", "operator": "equals", "rightValue": "product_yes" }',
    replace: '{ "conditionType": "comparison", "leftRef": "decisionDetail", "operator": "equals", "rightValue": "product_yes" }',
  },
  {
    name: "delete promptContractId mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: ', "promptContractId": "vision.productPresence.v1"',
    replace: '',
  },
  {
    name: "delete prompt binding mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '      { "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }\n',
    replace: '',
  },
  {
    name: "unknown promptContractId mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '      { "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }',
    replace: '      { "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.unknown", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }',
  },
  {
    name: "prompt outputSchemaRef mismatch mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '      { "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }',
    replace: '      { "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.mismatched_schema.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }',
  },
  {
    name: "missing post-action verification mutation",
    file: "src/map-plugins/builtins/tiktok-comment-evidence.map-package.json",
    search: ', "postActionVerification": { "required": true, "verificationKind": "panel-open", "expectedSignal": "comment-panel-visible", "timeoutMs": 5000, "onPassTransitionId": "verify-comments-open:success", "onFailTransitionId": "verify-comments-open:failed", "onAmbiguousTransitionId": "verify-comments-open:review" }',
    replace: '',
  },
  {
    name: "missing geometry proof mutation",
    file: "src/map-plugins/builtins/tiktok-comment-evidence.map-package.json",
    search: '"inputRefs": ["visualTargetRef", "geometryProofRef"]',
    replace: '"inputRefs": ["visualTargetRef"]',
  },
  {
    name: "activation snapshot proof mutation",
    file: "src/map-plugins/import/map-package-activation.ts",
    search: '  return {\n    activationId: input.activationId,\n    activationSnapshotRef: snapshotFields.activationSnapshotRef,\n    activationSnapshotHash: snapshotFields.activationSnapshotHash,\n',
    replace: '  return {\n    activationId: input.activationId,\n    activationSnapshotHash: snapshotFields.activationSnapshotHash,\n',
  },
  {
    name: "generated capability catalog drift mutation",
    file: "src/map-plugins/authoring/capability-catalog/capability-catalog.generated.json",
    search: '  "version": "2026-04-map-prompt-contract-v1",\n',
    replace: '  "version": "2026-04-map-prompt-contract-v1-tampered",\n',
  },
  {
    name: "routableByMap false mutation",
    file: "src/map-plugins/authoring/capability-catalog/policies.ts",
    search: '  "page-state": {\n    supportedTargets: ["browser-page"],\n    routableByMap: true,\n',
    replace: '  "page-state": {\n    supportedTargets: ["browser-page"],\n    routableByMap: false,\n',
  },
  {
    name: "missing capability child mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '"childCapabilityId": "detect-feed-ready"',
    replace: '"childCapabilityId": "missing-capability-child"',
  },
  {
    name: "hardcoded capability list in prompt template mutation",
    file: "src/map-plugins/authoring/map-authoring-template.ts",
    search: '    "Allowed Capabilities:",\n    formatCapabilitySection(inputPackage),\n',
    replace: '    "Allowed Capabilities:",\n    "- screenshot/full-screen-capture: stale manual catalog text",\n    formatCapabilitySection(inputPackage),\n',
  },
  {
    name: "approved manifest without validationReportRef mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '    "validationReportRef": "audit://map-plugin-package/builtin.tiktok-product-discovery/validation/v1",\n',
    replace: '    "validationReportRef": null,\n',
  },
  {
    name: "aiGenerated spoof mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "aiGenerated": true,\n',
    replace: '    "aiGenerated": false,\n',
  },
  {
    name: "ai draft activation mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "approvalStatus": "draft",\n',
    replace: '    "approvalStatus": "approved",\n',
  },
  {
    name: "ai draft active immediately mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "availabilityPolicy": "draft",\n',
    replace: '    "availabilityPolicy": "active",\n',
  },
  {
    name: "ai draft missing authoringPromptRef mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "authoringPromptRef": "audit://map-authoring/draft-placeholder",\n',
    replace: '',
  },
  {
    name: "ordinary feed exposes mapId mutation",
    file: "src/map-plugins/registry/active-map-registry.ts",
    search: '  availability: registration.mapPackage.taskTemplate.availabilityPolicy === "active" ? "ready" : "disabled",\n  defaultHumanGoal: registration.mapPackage.taskTemplate.defaultHumanGoal,\n',
    replace: '  availability: registration.mapPackage.taskTemplate.availabilityPolicy === "active" ? "ready" : "disabled",\n  mapId: registration.mapPackage.manifest.mapId,\n  defaultHumanGoal: registration.mapPackage.taskTemplate.defaultHumanGoal,\n',
  },
  {
    name: "commander direct registry write mutation",
    file: "src/lib/local-app-shell/task-template-registry.ts",
    search: '  const activeRegistry = getDefaultMapPluginRegistry().active;\n',
    replace: '  const activeRegistry = getDefaultMapPluginRegistry().active;\n  getDefaultMapPluginRegistry().active.activate({} as never, {} as never);\n',
  },
  {
    name: "forensics proof missing activationId mutation",
    file: "src/map-plugins/shared/map-package-proof.ts",
    search: '  activationId: string;\n',
    replace: '',
  },
  {
    name: "remove negative proof invocation mutation",
    file: "scripts/audit/domains/map-plugin-package/inspector.ts",
    search: '    : runNegativeProofHarness();\n',
    replace: '    : Promise.resolve({\n        findings: [],\n        phase: createPhase("negative-proof-harness", "PASS", true, "mutated bypass"),\n      });\n',
  },
];

type InspectorRunResult = {
  passed: boolean;
  violationCount: number;
  stdout: string;
  stderr: string;
  exitCode: number;
};

const summarizeInspectorFailure = (result: InspectorRunResult): string => {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  return [
    `exitCode=${result.exitCode}`,
    stdout.length > 0 ? `stdout=${stdout}` : null,
    stderr.length > 0 ? `stderr=${stderr}` : null,
  ]
    .filter((segment): segment is string => segment !== null)
    .join(" | ");
};

async function runInspector(): Promise<InspectorRunResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", INSPECTOR_RUNNER],
      {
        cwd: pathFromRepoRoot("."),
        env: {
          ...process.env,
          [SKIP_NEGATIVE_PROOF_ENV]: "1",
          TSX_DISABLE_CACHE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === null) {
        reject(new Error(`Inspector process exited without code. stderr: ${stderr}`));
        return;
      }

      const violationCount = stdout
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .length + (code !== 0 && stdout.length === 0 ? 1 : 0);

      resolve({
        passed: code === 0,
        violationCount,
        stdout,
        stderr,
        exitCode: code,
      });
    });
  });
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const mutated = await runInspector();
    if (mutated.passed) {
      throw new Error(`Inspector did not fail for ${mutation.name}: ${summarizeInspectorFailure(mutated)}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}: ${summarizeInspectorFailure(restored)}`);
  }
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
        lawId: MAP_PLUGIN_LAWS.ENFORCEMENT,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        `Map package inspector baseline must pass before negative-proof mutations can run: ${summarizeInspectorFailure(baseline)}`,
        "Map package negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Map package negative-proof harness rejects law-strength regressions, child-ability reintroduction, raw prompt/code payloads, prompt binding drift, lifecycle proof gaps, AI draft spoofing, catalog misuse, ordinary-feed leaks, Commander registry bypass, and negative-proof bypass mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Map package negative-proof harness failed.",
      "Map package negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
