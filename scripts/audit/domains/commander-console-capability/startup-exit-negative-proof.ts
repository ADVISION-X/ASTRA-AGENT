import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";
import { runStartupExitClassificationChecks } from "./startup-exit-classification-checks.js";

const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_GATE_LAW_ID = "GRASSEYE-STARTUP-ENTRYPOINT-005-V1";
const STARTUP_EXIT_MUTATION = {
  name: "startup controlled exit classification removal mutation",
  file: STARTUP_PATH,
  search: '  return shuttingDown || exit.signal === "SIGTERM" || exit.code === 143;\n',
  replace: '  return shuttingDown;\n',
} as const;

type StartupExitCheckResult = Awaited<ReturnType<typeof runStartupExitClassificationChecks>>;

type StartupExitMutationState = {
  originalContent: string;
  mutatedContent: string;
};

async function runCheck(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const result = await runStartupExitClassificationChecks();
  return { passed: result.findings.length === 0, violationCount: result.findings.length };
}

async function runDetailedCheck(): Promise<StartupExitCheckResult> {
  await buildAuditArtifacts();
  return await runStartupExitClassificationChecks();
}

function formatCheckOutput(result: StartupExitCheckResult): string {
  return JSON.stringify({
    classification: result.phase.classification,
    summary: result.phase.summary,
    findings: result.findings.map((finding) => ({
      lawId: finding.lawId,
      file: finding.file,
      line: finding.line,
      severity: finding.severity,
      message: finding.message,
    })),
  }, null, 2);
}

function applyMutationToContent(originalContent: string): string {
  const mutatedContent = originalContent.replace(STARTUP_EXIT_MUTATION.search, STARTUP_EXIT_MUTATION.replace);
  if (mutatedContent === originalContent) {
    throw new Error("Startup exit negative proof could not find the controlled-exit classification seed.");
  }
  return mutatedContent;
}

async function applyStartupExitMutation(filePath: string, originalContent: string): Promise<StartupExitMutationState> {
  const mutatedContent = applyMutationToContent(originalContent);
  await applyAuditMutation(filePath, originalContent, STARTUP_EXIT_MUTATION);
  return {
    originalContent,
    mutatedContent,
  };
}

async function writeStartupExitProofBundle(input: {
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
}): Promise<void> {
  await writeProductionMutationProof({
    owner: "commander-console",
    ownerTitle: "Commander Console",
    mutationName: STARTUP_EXIT_MUTATION.name,
    scenarioId: "startup-exit-controlled-shutdown-classification",
    coveredLawIds: [STARTUP_GATE_LAW_ID],
    coverageReasonByLawId: {
      [STARTUP_GATE_LAW_ID]: "The mutation removes SIGTERM and exit code 143 from controlled-shutdown classification, proving Commander startup must reject regressions in governed startup exit handling.",
    },
    mutatedFile: STARTUP_PATH,
    originalContent: input.originalContent,
    mutatedContent: input.mutatedContent,
    failOutput: input.failOutput,
    passOutput: input.passOutput,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });

  await writeOwnerBindingProof({
    owner: "commander-console",
    title: "Commander Console",
    scenarios: [{
      scenario: "startup controlled exit classification",
      outputFileName: "startup-controlled-exit-classification-fail.txt",
      output: input.failOutput,
    }],
    rollbackOutput: input.passOutput,
  });
}

function createBaselineFailure(): { findings: Finding[]; phase: InspectorPhase } {
  return createResult([
    createFinding({
      lawId: STARTUP_GATE_LAW_ID,
      file: STARTUP_PATH,
      line: 1,
      severity: "fatal",
      message: "Startup exit classification baseline must pass before startup exit negative proof runs.",
    }),
  ], "Startup exit negative proof could not start because the baseline inspector is already failing.");
}

function createMutationFailure(): { findings: Finding[]; phase: InspectorPhase } {
  return createResult([
    createFinding({
      lawId: STARTUP_GATE_LAW_ID,
      file: STARTUP_PATH,
      line: 1,
      severity: "fatal",
      message: "Startup exit classification check did not fail when startup lost controlled-exit classification.",
    }),
  ], "Startup exit negative proof failed because the inspector accepted a controlled-exit classification regression.");
}

function createRollbackFailure(): { findings: Finding[]; phase: InspectorPhase } {
  return createResult([
    createFinding({
      lawId: STARTUP_GATE_LAW_ID,
      file: STARTUP_PATH,
      line: 1,
      severity: "fatal",
      message: "Rollback verification failed after startup exit negative proof mutation.",
    }),
  ], "Startup exit negative proof failed because rollback did not restore a passing baseline.");
}

function createResult(findings: Finding[], summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings,
    phase: createPhase("startup-exit-negative-proof", findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT", findings.length === 0, summary),
  };
}

export async function runStartupExitNegativeProof(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const filePath = pathFromRepoRoot(STARTUP_PATH);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();

  try {
    const baseline = await runCheck();
    if (!baseline.passed) {
      return createBaselineFailure();
    }

    const mutationState = await applyStartupExitMutation(filePath, state.original);
    const mutated = await runDetailedCheck();
    if (mutated.findings.length === 0) {
      return createMutationFailure();
    }

    const failOutput = formatCheckOutput(mutated);

    await restoreAuditFileState(filePath, state);
    const restored = await runDetailedCheck();
    if (restored.findings.length > 0) {
      return createRollbackFailure();
    }

    await writeStartupExitProofBundle({
      originalContent: mutationState.originalContent,
      mutatedContent: mutationState.mutatedContent,
      failOutput,
      passOutput: formatCheckOutput(restored),
      startedAt,
      endedAt: new Date().toISOString(),
    });

    return createResult([], "Startup exit negative proof rejects controlled-exit classification regressions and restores the passing baseline.");
  } finally {
    await restoreAuditFileState(filePath, state);
  }
}