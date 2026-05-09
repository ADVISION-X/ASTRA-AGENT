import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow, hasCallExpressionPath } from "./inspection-ast-helpers.js";

const STEP_DISPATCH_SHARED_PATH = "src/capabilities/orchestration/runtime/step-dispatch-shared.ts";
const STEP_DISPATCHER_PATH = "src/capabilities/orchestration/runtime/step-dispatcher.ts";
const STEP_DISPATCH_REQUEST_BUILDERS_PATH = "src/capabilities/orchestration/runtime/step-dispatch-request-builders.ts";
const NERVE_BUS_ADAPTER_PATH = "src/capabilities/orchestration/runtime/orchestration-nerve-bus-adapter.ts";
const LOOP_ITERATION_SUPPORT_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration-support.ts";

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

function collectLineNumber(text: string, needle: string): number {
  const lines = text.split("\n");
  const lineIndex = lines.findIndex((line) => line.includes(needle));
  return lineIndex >= 0 ? lineIndex + 1 : 1;
}

function createFatalFinding(input: { lawId: string; file: string; line: number; message: string }): Finding {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line,
    severity: "fatal",
    message: input.message,
  });
}

function createRuntimePhase(name: string, findings: Finding[], passSummary: string, failSummary: string) {
  return createPhase(name, findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, findings.length === 0 ? passSummary : failSummary);
}

function collectSharedTimeoutPolicyFindings(sharedSource: ReturnType<typeof getSourceFileOrThrow>, findings: Finding[]): void {
  const sharedText = sharedSource.getFullText();
  if (!sharedText.includes("PRODUCTION_STEP_TIMEOUT_MS_BY_KIND") || !sharedText.includes("PRODUCTION_STEP_TIMEOUT_MS_BY_ABILITY") || sharedText.includes("step.timeoutPolicy")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCH_SHARED_PATH, line: 1, message: "Orchestration must resolve dispatch timeout from production runtime policy only; maps must not own timeoutPolicy." }));
  }
}

function collectDispatchTimeoutFindings(dispatcherSource: ReturnType<typeof getSourceFileOrThrow>, findings: Finding[]): void {
  const dispatcherText = dispatcherSource.getFullText();
  if (!hasCallExpressionPath(dispatcherSource, ["dispatchWithTimeout"]) || !dispatcherText.includes("AI dispatch timed out after ${timeoutMs}ms")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCHER_PATH, line: 1, message: "AI step dispatch must be wrapped by the resolved step timeout and return a governed timeout failure." }));
  }
  if (!dispatcherText.includes("async (signal)") || !dispatcherText.includes("signal,")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCHER_PATH, line: 1, message: "AI step dispatchWithTimeout must pass its AbortSignal into sendRequestToAi, not discard it with _signal." }));
  }
}

function collectRequestBuilderTimeoutFindings(requestBuilderSource: ReturnType<typeof getSourceFileOrThrow>, findings: Finding[]): void {
  if (!requestBuilderSource.getFullText().includes("timeoutMs: resolveStepTimeoutMs(input.step)")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCH_REQUEST_BUILDERS_PATH, line: 1, message: "AI Nerve Bus dispatch request must carry the production-owned step timeout value." }));
  }
}

function collectNerveBusAdapterFindings(nerveBusAdapterSource: ReturnType<typeof getSourceFileOrThrow>, findings: Finding[]): void {
  if (!nerveBusAdapterSource.getFullText().includes("signal: input.signal")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: NERVE_BUS_ADAPTER_PATH, line: 1, message: "Orchestration Nerve Bus AI adapter must pass the AI dispatch AbortSignal into nerveBus.requestAi." }));
  }
}

export function inspectRoundAndVideoVisitChain(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const sharedSource = getSourceFileOrThrow(project, STEP_DISPATCH_SHARED_PATH);
  const loopSupportSource = getSourceFileOrThrow(project, LOOP_ITERATION_SUPPORT_PATH);
  const sharedText = sharedSource.getFullText();
  const loopSupportText = loopSupportSource.getFullText();
  const findings: Finding[] = [];

  if (sharedText.includes("videoVisitId: null")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: STEP_DISPATCH_SHARED_PATH, line: collectLineNumber(sharedText, "videoVisitId: null"), message: "Orchestration dispatch chain must bind a non-null videoVisitId per mission round; no-video dispatch chains can hide same-video AI loops." }));
  }
  if (!sharedText.includes("video-visit") || !sharedText.includes("state.currentRoundIndex")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: STEP_DISPATCH_SHARED_PATH, line: 1, message: "Orchestration dispatch chain must derive videoVisitId from mission identity and currentRoundIndex." }));
  }
  if (!loopSupportText.includes("shouldAdvanceMissionRound") || !loopSupportText.includes("verify-next-item-advanced") || !loopSupportText.includes("capture-video-viewport")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_SUPPORT_PATH, line: 1, message: "Mission round advancement must treat verify-next-item-advanced returning to capture-video-viewport as the governed round boundary." }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "round-video-visit-chain",
      findings,
      "Orchestration binds non-null per-round videoVisitId and advances rounds after governed next-item AI verification.",
      "Orchestration can still dispatch no-video loops or fail to advance rounds after verified next-video scroll.",
    ),
  };
}

export function inspectAiStepTimeoutChain(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const sharedSource = getSourceFileOrThrow(project, STEP_DISPATCH_SHARED_PATH);
  const dispatcherSource = getSourceFileOrThrow(project, STEP_DISPATCHER_PATH);
  const requestBuilderSource = getSourceFileOrThrow(project, STEP_DISPATCH_REQUEST_BUILDERS_PATH);
  const nerveBusAdapterSource = getSourceFileOrThrow(project, NERVE_BUS_ADAPTER_PATH);
  const findings: Finding[] = [];

  collectSharedTimeoutPolicyFindings(sharedSource, findings);
  collectDispatchTimeoutFindings(dispatcherSource, findings);
  collectRequestBuilderTimeoutFindings(requestBuilderSource, findings);
  collectNerveBusAdapterFindings(nerveBusAdapterSource, findings);

  return {
    findings,
    phase: createRuntimePhase(
      "ai-step-timeout-chain",
      findings,
      "Orchestration applies production-owned step timeout policy to AI dispatch and timeout terminal failure.",
      "Orchestration still lets AI dispatch ignore the production-owned step timeout policy.",
    ),
  };
}