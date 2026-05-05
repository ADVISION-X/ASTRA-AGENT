import { SyntaxKind, type Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import type { PostActionVerificationRuntimeContext } from "../../../../src/capabilities/post-action-verification/runtime/post-action-verification-runtime-context.js";
import { createSystemPostActionVerificationClock } from "../../../../src/capabilities/post-action-verification/runtime/verification-clock.js";
import { dispatchPostActionVerificationFailure } from "../../../../src/capabilities/post-action-verification/runtime/verification-dispatch-failure.js";
import { PostActionVerificationAbilityInputSchema } from "../../../../src/capabilities/post-action-verification/schema.js";
import { createPostActionRuntime } from "../../../../src/lib/local-runtime/workbench-post-action-runtime.js";
import { buildPostActionVerificationInput } from "../../../../src/lib/local-runtime/workbench-post-action-dispatch-input.js";

import { LAW_IDS } from "./config.js";
import { getSource } from "./project-access.js";

const EXECUTOR_PATH = "src/lib/local-runtime/workbench-ability-command-executor.ts";
const BUILDER_PATH = "src/lib/local-runtime/workbench-post-action-dispatch-input.ts";

type RuntimePhaseResult = {
  findings: Finding[];
  phase: InspectorPhase;
};

function createRuntimePhase(name: string, findings: Finding[], passSummary: string, failSummary: string): RuntimePhaseResult {
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary),
  };
}

function inspectLocalRuntimeRoute(project: Project): RuntimePhaseResult {
  const executorSource = getSource(project, EXECUTOR_PATH);
  const callExpression = executorSource.getDescendantsOfKind(SyntaxKind.CallExpression).find((node) => node.getExpression().getText() === "buildPostActionVerificationInput") ?? null;
  const findings: Finding[] = [];

  if (callExpression === null) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Local runtime must route post-action-verification dispatch through buildPostActionVerificationInput." }));
  } else {
    const args = callExpression.getArguments().map((arg) => arg.getText());
    if (args.length !== 3 || args[0] !== "runtime") {
      findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: EXECUTOR_PATH, line: callExpression.getStartLineNumber(), severity: "fatal", message: "Local runtime must pass the governed runtime into buildPostActionVerificationInput so page-state observations come from the current browser session." }));
    }
  }

  return createRuntimePhase(
    "local-runtime-route",
    findings,
    "Local runtime routes post-action verification through the governed builder with runtime session access.",
    "Local runtime no longer routes post-action verification through the governed builder/runtime handoff.",
  );
}

function createFixtureRuntime(currentUrl: string, loginState: "logged_in" | "login_required"): Parameters<typeof buildPostActionVerificationInput>[0] {
  return {
    browserController: {
      getSessionState: () => ({
        currentUrl,
        currentTitle: "For You",
        loginState,
      }),
    },
  } as Parameters<typeof buildPostActionVerificationInput>[0];
}

function createFixtureEnvelope(): Parameters<typeof buildPostActionVerificationInput>[1] {
  return {
    commandName: "verify-page-opened",
    missionId: "mission-1",
    runId: "run-1",
    sessionId: "mission-1",
    roundId: "0",
    videoVisitId: null,
    stepId: "verify-page-opened",
    mapPackageId: "builtin.tiktok-seeding-video-discovery",
    mapPackageVersion: "1.0.0",
    selectedMapId: "tiktok.seeding-video.discovery.meta.v1",
    selectedMapVersion: "1.0.0",
    activationSnapshotRef: "activation-snapshot:1",
    capabilityCallId: "mission-1:verify-page-opened:1:ability",
    nerveBusEnvelopeId: "env-1",
    inputRef: "result-ref-1",
    idempotencyKey: "idem-1",
    createdAt: "2026-05-05T00:00:00.000Z",
  } as Parameters<typeof buildPostActionVerificationInput>[1];
}

function createFixturePayload(): Parameters<typeof buildPostActionVerificationInput>[2] {
  return {
    documentType: "orchestration.ability_dispatch",
    documentRef: "result-ref-1",
    summary: "Verify opened page",
    entityRefs: [],
    evidenceRefs: [],
    contentBlocks: [{ key: "abilityResultRef", value: "result-ref-1" }],
  } as Parameters<typeof buildPostActionVerificationInput>[2];
}

function createFailureContext(): PostActionVerificationRuntimeContext {
  return {
    clock: createSystemPostActionVerificationClock(),
    evidenceReadPort: {
      listObservations: (request) => request.observationSet.observations,
      getObservationByRef: (request, ref) => request.observationSet.observations.find((observation) => observation.ref === ref) ?? null,
      getEvidenceByRef: (request, ref) => [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].find((evidence) => evidence?.evidenceRef === ref) ?? null,
      getActionLogByRef: (request, ref) => {
        const actionLogRef = request.actionProof.actionLogRef ?? request.actionProof.actionRecordRef;
        return actionLogRef === ref
          ? {
              actionLogRef: ref,
              sourceRuntimeProofRef: request.actionProof.sourceRuntimeProofRef,
              sourceActionResultRef: request.actionProof.sourceActionResultRef,
              sourceActionOutputRef: request.actionProof.sourceActionOutputRef,
            }
          : null;
      },
      verifyProofRef: (request, ref) => request.actionProof.sourceRuntimeProofRef === ref,
      verifyEvidenceBinding: () => false,
    },
  };
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function runGovernedFixtureChecks(): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const runtime = createFixtureRuntime("https://www.tiktok.com/foryou", "logged_in");
    const input = buildPostActionVerificationInput(runtime, createFixtureEnvelope(), createFixturePayload());
    const parsedInput = PostActionVerificationAbilityInputSchema.parse(input);
    const pageStateObservation = parsedInput.observationSet.observations[0];

    assertCondition(parsedInput.runId === "run-1", "Builder must preserve runId from the governed envelope.");
    assertCondition(parsedInput.expectedOutcome.expectedUrlHost === "www.tiktok.com", "Builder must align verify-page-opened expectedUrlHost with the canonical platform host.");
    assertCondition(pageStateObservation?.kind === "page_state", "Builder must emit a page_state observation for verify-page-opened.");
    assertCondition(pageStateObservation?.source.sourceProofRef === parsedInput.actionProof.sourceRuntimeProofRef, "Builder must bind page-state observation back to the governed source proof ref.");

    const verificationResult = await createPostActionRuntime().postActionVerificationAbilityGroup.execute(parsedInput);
    assertCondition(verificationResult.status === "success" && verificationResult.verificationDecision === "verified", "verify-page-opened fixture must reach governed success for a ready TikTok feed URL.");

    const invalidInputResult = dispatchPostActionVerificationFailure({
      rawInput: {
        ...parsedInput,
        runId: "",
      },
      context: createFailureContext(),
      failureReason: "input_schema_invalid",
      statusMessage: "invalid input",
    });

    assertCondition(invalidInputResult.runId !== null, "Invalid-input fallback result must not emit runId=null.");
    assertCondition(invalidInputResult.runtimeProof.runId !== null, "Invalid-input fallback proof must not emit runId=null.");
    assertCondition(invalidInputResult.runId === invalidInputResult.runtimeProof.runId, "Invalid-input fallback result/proof runId must remain consistent.");
  } catch (error) {
    findings.push(createFinding({
      lawId: LAW_IDS.PROOF,
      file: BUILDER_PATH,
      line: 1,
      severity: "fatal",
      message: error instanceof Error ? error.message : "Post Action Verification governed runtime fixture failed.",
    }));
  }

  return findings;
}

export async function runGovernedRuntimeChecks(project: Project): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const localRuntimeRoute = inspectLocalRuntimeRoute(project);
  const governedFixtureFindings = await runGovernedFixtureChecks();
  const governedFixtures = createRuntimePhase(
    "governed-runtime-fixtures",
    governedFixtureFindings,
    "Governed PAV fixtures prove builder/schema parity, invalid-input fallback integrity, and observation-only page-open verification success.",
    "Governed PAV fixtures still expose builder drift, invalid-input fallback regression, or broken observation-only page-open verification.",
  );

  return {
    findings: [...localRuntimeRoute.findings, ...governedFixtures.findings],
    phases: [localRuntimeRoute.phase, governedFixtures.phase],
  };
}
