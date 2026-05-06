import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { mutateAndVerify, writeMutationProofBundle, writeOwnerBindingBundle } from "../_shared/negative-proof-runtime.js";
import { runStartupExitClassificationChecks } from "./startup-exit-classification-checks.js";

const STARTUP_PATH = "scripts/startup/launch-grasseye.mjs";
const STARTUP_GATE_LAW_ID = "GRASSEYE-STARTUP-ENTRYPOINT-005-V1";
const STARTUP_EXIT_MUTATION = {
  name: "startup controlled exit classification removal mutation",
  file: STARTUP_PATH,
  search: '  return shuttingDown || exit.signal === "SIGTERM" || exit.code === 143;\n',
  replace: '  return shuttingDown;\n',
} as const;

const STARTUP_EXIT_COVERAGE = {
  [STARTUP_EXIT_MUTATION.name]: {
    coveredLawIds: [STARTUP_GATE_LAW_ID],
    coverageReasonByLawId: {
      [STARTUP_GATE_LAW_ID]: "The mutation removes SIGTERM and exit code 143 from controlled-shutdown classification, proving Commander startup must reject regressions in governed startup exit handling.",
    },
  },
} as const;

type StartupExitCheckResult = Awaited<ReturnType<typeof runStartupExitClassificationChecks>>;

async function runCheck(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const result = await runStartupExitClassificationChecks();
  return { passed: result.findings.length === 0, violationCount: result.findings.length };
}

async function runDetailedCheck(): Promise<StartupExitCheckResult> {
  await buildAuditArtifacts();
  return await runStartupExitClassificationChecks();
}

async function runCheckWithOutput(): Promise<{ passed: boolean; violationCount: number; output: string }> {
  const result = await runDetailedCheck();
  return {
    passed: result.findings.length === 0,
    violationCount: result.findings.length,
    output: formatCheckOutput(result),
  };
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
  const baseline = await runCheck();
  if (!baseline.passed) {
    return createBaselineFailure();
  }

  try {
    const record = await mutateAndVerify(runCheckWithOutput, STARTUP_EXIT_MUTATION);

    await writeMutationProofBundle({
      owner: "commander-console",
      ownerTitle: "Commander Console",
      record,
      coverageByMutationName: STARTUP_EXIT_COVERAGE,
    });

    await writeOwnerBindingBundle({
      owner: "commander-console",
      title: "Commander Console",
      ownerBindingMutationNames: [STARTUP_EXIT_MUTATION.name],
      records: [record],
    });

    return createResult([], "Startup exit negative proof rejects controlled-exit classification regressions and restores the passing baseline.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Inspector did not fail")) {
      return createMutationFailure();
    }
    if (error instanceof Error && error.message.startsWith("Rollback verification failed")) {
      return createRollbackFailure();
    }
    throw error;
  }
}