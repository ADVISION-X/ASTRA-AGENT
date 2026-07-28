import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const paths = {
  checkpoint: "src/capabilities/ai-input-gateway/runtime/web-chat-response-checkpoint.ts",
  executionState: "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts",
  managed: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  failureClassification: "src/capabilities/ai-input-gateway/failure-classification.ts",
  shared: "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  submissionCheckpoint: "src/capabilities/ai-input-gateway/providers/web-chat-submission-checkpoint.ts",
  resume: "src/capabilities/ai-input-gateway/providers/web-chat-resume.ts",
  acceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts",
  recoveryAcceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-recovery.acceptance-helper.ts",
  realChrome: "src/capabilities/ai-input-gateway/acceptance/web-chat-restart-recovery.real-chrome.ts",
  chatTitle: "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  windowControl: "src/lib/browser/current-chrome-window-control.ts",
  browserPrimitives: "src/lib/browser/current-chrome-browser-controller-primitives.ts",
  providerTab: "src/capabilities/ai-input-gateway/runtime/web-chat-single-provider-tab.ts",
  routing: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  responseCapture: "src/capabilities/ai-input-gateway/providers/web-chat-response-capture.ts",
} as const;

type RecoverySources = Record<keyof typeof paths, SourceFile>;

const sourceValues = (files: readonly SourceFile[]): Set<string> =>
  new Set(files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => String(node.compilerNode.escapedText)),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .map((node) => node.getName()),
  ]));

const pushMissingValues = (input: {
  findings: InspectorFinding[];
  lawId: string;
  checkId: string;
  filePath: string;
  message: string;
  values: Set<string>;
  required: readonly string[];
}): void => {
  const missing = input.required.filter((value) => !input.values.has(value));
  if (missing.length === 0) return;
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.message}: ${missing.join(", ")}.`,
  }));
};

const collectSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): RecoverySources | null => {
  const entries = Object.entries(paths).map(([key, repoPath]) => {
    const file = context.project.getSourceFile(resolveFromRepo(repoPath));
    if (!file) {
      findings.push(createFinding({
        checkId: "ai-input-gateway/response-checkpoint-recovery",
        lawId,
        filePath: repoPath,
        message: `Response recovery source ${key} must exist.`,
      }));
    }
    return [key, file] as const;
  });
  if (entries.some(([, file]) => !file)) return null;
  return Object.fromEntries(entries) as RecoverySources;
};

const inspectCheckpointAndLedger = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  pushMissingValues({
    findings,
    lawId,
    checkId: "ai-input-gateway/response-checkpoint-recovery",
    filePath: paths.checkpoint,
    message: "Response checkpoint recovery is missing",
    values: sourceValues(Object.values(sources)),
    required: [
      "persistWebChatResponseCheckpoint",
      "readWebChatResponseCheckpoint",
      "responseCheckpoint",
      "response_checkpointed",
      "recovery_pending",
      "onResponseCaptured",
    ],
  });
  pushMissingValues({
    findings,
    lawId,
    checkId: "ai-input-gateway/failure-ledger",
    filePath: paths.executionState,
    message: "Traceable failure ledger is missing",
    values: sourceValues([
      sources.executionState,
      sources.failureClassification,
    ]),
    required: [
      "WebChatExecutionFailure",
      "failures",
      "classification",
      "recoverable",
      "classifyWebChatFailure",
      "isTransientProviderUnavailability",
    ],
  });
};

const inspectSubmissionOrder = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const checkpointInitializer = sources.submissionCheckpoint
    .getVariableDeclaration("checkpointSubmittedWebChatTurn")
    ?.getInitializer();
  const checkpointCalls = checkpointInitializer
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? [];
  const firstCapture = checkpointCalls.findIndex((name) => name === "captureProof");
  const firstObserved = checkpointCalls.findIndex(
    (name) => name === "persistObservedSubmission",
  );
  const secondCapture = checkpointCalls.findIndex(
    (name, index) => index > firstObserved && name === "captureProof",
  );
  const submitted = checkpointCalls.findIndex((name) => name.endsWith("onSubmitted"));
  const executionInitializer = sources.shared
    .getVariableDeclaration("executeWebChatConversation")
    ?.getInitializer();
  const executionCalls = executionInitializer
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? [];
  const checkpointed = executionCalls.findIndex((name) =>
    name.endsWith("onResponseCaptured"));
  const published = executionCalls.findIndex((name) =>
    name === "buildCompletedWebChatResponse");
  if (
    firstCapture < 0
    || firstObserved <= firstCapture
    || secondCapture <= firstObserved
    || submitted <= secondCapture
    || checkpointed <= submitted
    || published <= checkpointed
  ) {
    findings.push(createFinding({
      checkId: "ai-input-gateway/transient-submission-checkpoint",
      lawId,
      filePath: paths.shared,
      message: "Transient submit proof, canonical proof, answer checkpoint and publication must remain ordered.",
    }));
  }
};

const RECOVERY_SURFACE_CHECKS: ReadonlyArray<{
  checkId: string;
  filePath: string;
  sourceKeys: ReadonlyArray<keyof RecoverySources>;
  required: readonly string[];
  message: string;
}> = [
    {
      checkId: "ai-input-gateway/offscreen-sidebar-recovery",
      filePath: paths.routing,
      sourceKeys: ["providerTab", "routing"],
      required: ["focusSingleProviderTab", "scroll_title", "scrollDeltaY"],
      message: "Exact sidebar routing is missing",
    },
    {
      checkId: "ai-input-gateway/bounded-patrol-cadence",
      filePath: paths.responseCapture,
      sourceKeys: ["responseCapture", "acceptance"],
      required: [
        "resolveManagedGptPollIntervalMs",
        "WEB_CHAT_PATROL_INTERVAL_MS",
        "DEFAULT_MANAGED_GPT_POLL_INTERVAL_MS",
      ],
      message: "Bounded operator patrol cadence is missing",
    },
    {
      checkId: "ai-input-gateway/response-checkpoint-recovery",
      filePath: paths.acceptance,
      sourceKeys: ["acceptance", "recoveryAcceptance"],
      required: [
        "assertResponseCheckpointRecovery",
        "assertFailureLedger",
        "submissionCount",
        "readWebChatResponseCheckpoint",
      ],
      message: "Checkpoint acceptance is missing",
    },
    {
      checkId: "ai-input-gateway/response-checkpoint-recovery",
      filePath: paths.realChrome,
      sourceKeys: ["realChrome"],
      required: [
        "abortController",
        "interruptedRecord",
        "recoveredRecord",
        "markerProbe",
        "responseCheckpoint",
        "WEB_CHAT_RECOVERY_RUN_ROOT",
        "exactMarkedUserTurnCount",
      ],
      message: "Real Chrome restart acceptance is missing",
    },
    {
      checkId: "ai-input-gateway/bounded-rename-recovery",
      filePath: paths.chatTitle,
      sourceKeys: ["chatTitle"],
      required: ["openTitleEditor", "lastRenameNotReady", "renameNotReady"],
      message: "Bounded title recovery is missing",
    },
    {
      checkId: "ai-input-gateway/controlled-chrome-window-identity",
      filePath: paths.windowControl,
      sourceKeys: ["windowControl", "browserPrimitives", "providerTab"],
      required: ["runJxa", "activateChrome", "focusSingleProviderTab"],
      message: "Exact controlled Chrome window binding is missing",
    },
];

const inspectRecoverySurfaces = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const check of RECOVERY_SURFACE_CHECKS) {
    pushMissingValues({
      findings,
      lawId,
      checkId: check.checkId,
      filePath: check.filePath,
      message: check.message,
      values: sourceValues(check.sourceKeys.map((key) => sources[key])),
      required: check.required,
    });
  }
};

export const inspectAiInputGatewayRecovery = (
  context: InspectorContext,
  lawId: string,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const sources = collectSources(context, findings, lawId);
  if (!sources) return findings;
  inspectCheckpointAndLedger(sources, findings, lawId);
  inspectSubmissionOrder(sources, findings, lawId);
  inspectRecoverySurfaces(sources, findings, lawId);
  return findings;
};
