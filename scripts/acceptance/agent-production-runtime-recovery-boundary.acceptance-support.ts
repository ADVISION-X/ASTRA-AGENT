import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Project } from "ts-morph";

import {
  inspectAgentProductionRuntime,
  runtimeManifestOwnershipDrift,
} from "../audit/domains/agent-production-runtime/inspector.js";

const readRuntimeSource = (relativePath: string) => readFile(
  new URL(`../../src/lib/local-runtime/production/${relativePath}`, import.meta.url), "utf8",
);

const exerciseLifecycleMutant = (): void => {
  const project = new Project({ tsConfigFilePath: path.resolve("tsconfig.json") });
  const outbox = project.getSourceFileOrThrow(path.resolve(
    "src/lib/local-runtime/production/store-outbox.ts",
  ));
  outbox.replaceWithText(outbox.getFullText().replace(
    'executionFailure("failed", authority.lastError)',
    'executionFailure("failed", "PRODUCTION_OUTBOX_ATTEMPT_ENDED")',
  ));
  const findings: Parameters<typeof inspectAgentProductionRuntime>[1] = [];
  inspectAgentProductionRuntime({
    project,
    sealedRoot: path.resolve("."),
    selectedLawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V58",
    targetSet: { queryRef: "acceptance:runtime-lifecycle-mutant", count: 1 },
    targetPaths: [],
    lawRequirements: [],
    planEntry: {
      capabilityDomain: "agent-production-runtime",
      manifestPath: "scripts/audit/domains/agent-production-runtime/manifest.json",
      ownerInspectorPath: "scripts/audit/domains/agent-production-runtime/inspector.ts",
      executionGroup: "domain",
      lawIds: ["LAW-AGENT-PRODUCTION-RUNTIME-001-V58"],
    },
    generatedPlan: [],
  }, findings);
  assert.ok(findings.some((finding) =>
    finding.checkId === "agent-production-runtime/no-local-business-lifecycle-adjudication"),
  "an Outbox mutant that converts a delivery fact into attempt-ended must fail closed");
};

const exerciseManifestAndLawOwnership = async (): Promise<void> => {
  const runtimeManifest = JSON.parse(await readFile(
    new URL("../audit/domains/agent-production-runtime/manifest.json", import.meta.url), "utf8",
  )) as { ownedPaths: string[] };
  assert.deepEqual(runtimeManifestOwnershipDrift(runtimeManifest.ownedPaths), []);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    ...runtimeManifest.ownedPaths,
    "src/mediator/agent-production-route.ts",
    "src/plugins/**",
  ]), ["src/mediator/agent-production-route.ts", "src/plugins/**"]);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md",
    "docs/specs/agent-production-runtime/**",
    "scripts/acceptance/agent-production-runtime.acceptance.ts",
    "scripts/audit/domains/agent-production-runtime/**",
    "src/lib/local-runtime/production/**",
  ]), []);

  const runtimeLawSource = await readFile(
    new URL("../../.github/instructions/agent-rules/功能法案.md", import.meta.url), "utf8",
  );
  const runtimeLawRecords = [...runtimeLawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
    .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden: string[] });
  const runtimeCoreLaw = runtimeLawRecords.find(
    (record) => record.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V58",
  );
  assert.ok(runtimeCoreLaw);
  for (const token of [
    "只有 Website.ai-acceptance",
    "新 attempt 任意读取旧 attempt",
    "第二 Outbox",
    "第二 state machine",
  ]) assert.ok(runtimeCoreLaw.forbidden.some((entry) => entry.includes(token)), token);
};

export const exerciseProductionRuntimeSourceBoundaries = async (): Promise<void> => {
  const [runtimeSource, runtimeStartupSource, businessAdmissionSource, runtimeLoopsSource,
    outboxSource, storeFoundationSource, reconciliationSource, executorSource, storeSource] =
    await Promise.all([
      readRuntimeSource("runtime-claim.ts"),
      readRuntimeSource("runtime-startup.ts"),
      readRuntimeSource("runtime-business-admission.ts"),
      readRuntimeSource("runtime-loops.ts"),
      readRuntimeSource("store-outbox.ts"),
      readRuntimeSource("store-foundation.ts"),
      readRuntimeSource("cloud-reconciliation-client.ts"),
      readRuntimeSource("executor.ts"),
      readRuntimeSource("store-task-state.ts"),
    ]);
  assert.doesNotMatch(runtimeSource, /outcome: "failed"[\s\S]{0,300}BUSINESS_ADMISSION_PENDING/u);
  assert.doesNotMatch(runtimeLoopsSource, /outcome: "failed"[\s\S]{0,300}BUSINESS_ADMISSION_PENDING/u);
  assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
  assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
  assert.match(executorSource, /gpt: gptExecution\.tools/u);
  const executeClaimSource = runtimeSource.slice(runtimeSource.indexOf("export const executeClaim"));
  assert.match(storeSource, /attempt_failure_json=null,current_reason='LEASE_REGRANTED'/u);
  assert.doesNotMatch(executeClaimSource, /recoverAcceptedClaim|reconcileStaleFenceCheckpoint/u);
  assert.doesNotMatch(outboxSource, /recoverCheckpointPrefix|deliverReauthorizedStaleCheckpoint/u);
  assert.doesNotMatch(runtimeStartupSource, /PROCESS_RESTART_ATTEMPT_ENDED|endUnsentAttemptWrites/u);
  assert.doesNotMatch(runtimeSource, /ATTEMPT_ENDED:/u);
  assert.doesNotMatch(businessAdmissionSource, /discardStagedResult|ATTEMPT_ENDED/u);
  assert.doesNotMatch(storeSource, /discardStagedResult/u);
  assert.match(executorSource, /abort_signal\.aborted[\s\S]{0,220}PRODUCTION_EXECUTION_ABORTED/u);
  assert.doesNotMatch(executorSource, /reconcilePermanentCancellation/u);
  assert.doesNotMatch(storeSource, /Continuation|Checkpoint/u);
  assert.match(reconciliationSource, /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u);
  assert.match(businessAdmissionSource, /websiteJobAbsent/u);
  assert.match(businessAdmissionSource, /purgeDeletedJob/u);
  assert.match(runtimeSource, /purgeDeletedJob/u);
  assert.doesNotMatch(runtimeLoopsSource, /BrowserQuarantine|reconcilePermanentlyRevokedTargetLocal/u);
  assert.doesNotMatch(runtimeLoopsSource, /flushOutbox|pendingOutbox\(\)|sendProductionOutboxWrite/u);
  assert.match(storeSource, /supersedeUnsentWritesForWebsiteAttempt/u);
  assert.match(storeSource, /WEBSITE_ATTEMPT_REPLACED/u);
  assert.doesNotMatch(`${storeSource}\n${outboxSource}`, /ATTEMPT_ENDED|PRODUCTION_OUTBOX_ATTEMPT_ENDED/u);
  assert.match(outboxSource, /executionFailure\("failed", authority\.lastError\)/u);
  exerciseLifecycleMutant();
  assert.match(storeSource, /purgeJob\(jobId: string\)/u);
  assert.match(storeSource, /delete from production_outbox/u);
  assert.match(outboxSource, /sent_at is null and last_error is null/u);
  assert.doesNotMatch(`${storeFoundationSource}\n${outboxSource}`,
    /next_delivery_at|nextDeliveryAt|pendingOutbox\(/u);
  await exerciseManifestAndLawOwnership();
};
