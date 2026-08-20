import { SyntaxKind } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  addBrowserFinding,
  assertCallOrder,
  assertStringBeforeAssignment,
  forbidAstFacts,
  hasPrivateConstructor,
  requireAstFacts,
  requireAstSource,
  sourceHasIdentifier,
  type BrowserLawBinding,
} from "./browser-authority-inspector-support.js";

type CoreLaws = Readonly<{
  exact: BrowserLawBinding;
  auth: BrowserLawBinding;
  executor: BrowserLawBinding;
  evaluate: BrowserLawBinding;
}>;

const inspectExactTarget = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const checkId = "local-browser-session/exact-target-authority";
  const sources = [
    ["src/lib/browser/browser-authority-api.ts", ["BrowserAuthorityBroker", "BrowserTargetLease", "BrowserTargetRef", "BrowserDocumentRef", "acquireForExecution"]],
    ["src/lib/browser/exact-target/browser-command-actor.ts", ["executionBinding", "targetLeaseRef", "documentRef", "issueBrowserCommandPermit"]],
    ["src/lib/browser/exact-target/browser-target-lease.ts", ["assertValid", "getTarget", "getLeaseState", "observeCapability"]],
    ["src/lib/browser/exact-target/browser-command-contract.ts", []],
    ["src/lib/browser/exact-target/browser-target-registry.ts", []],
  ] as const;
  for (const [filePath, identifiers] of sources) {
    const source = requireAstSource(context, findings, checkId, laws.exact, filePath);
    if (!source) continue;
    requireAstFacts({
      source,
      findings,
      checkId,
      law: laws.exact,
      filePath,
      identifiers,
      strings: filePath.endsWith("browser-command-contract.ts")
        ? ["DOCUMENT_STALE"]
        : filePath.endsWith("browser-target-registry.ts")
          ? ["TARGET_FOREIGN_AUTHORITY", "DOCUMENT_STALE"]
          : filePath.endsWith("browser-target-lease.ts") ? ["OUTCOME_UNKNOWN"] : [],
    });
    if (filePath.endsWith("browser-authority-api.ts")
      || filePath.endsWith("browser-command-actor.ts")
      || filePath.endsWith("browser-target-lease.ts")) {
      forbidAstFacts({
        source,
        findings,
        checkId,
        law: laws.exact,
        filePath,
        identifiers: ["BrowserTargetSession", "createTargetSession", "evaluate", "evaluateTarget", "activeTab", "currentPage"],
        strings: ["evaluate_target"],
      });
    }
  }
};

const inspectNoUnauthenticatedSession = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const checkId = "local-browser-session/no-unauth-session-type";
  const productionPaths = [
    "src/lib/browser/browser-authority-api.ts",
    "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
    "src/lib/browser/transport/transport-actor.ts",
    "src/lib/browser/exact-target/browser-target-lease.ts",
    "src/lib/local-runtime/workbench-browser-support.ts",
    "src/lib/local-runtime/workbench-assembly.ts",
    "src/lib/local-runtime/workbench-status.ts",
    "src/lib/local-runtime/workbench.ts",
    "src/app/server.ts",
  ] as const;
  for (const filePath of productionPaths) {
    const source = requireAstSource(context, findings, checkId, laws.auth, filePath);
    if (!source) continue;
    forbidAstFacts({
      source,
      findings,
      checkId,
      law: laws.auth,
      filePath,
      identifiers: ["transportReady", "UnauthenticatedBrowserSession"],
      strings: ["browserSession", "Browser session transport is not authenticated"],
    });
  }
  const statePath = "src/lib/browser/infrastructure/browser-control-state.ts";
  const state = requireAstSource(context, findings, checkId, laws.auth, statePath);
  if (state) requireAstFacts({
    source: state,
    findings,
    checkId,
    law: laws.auth,
    filePath: statePath,
    strings: ["ABSENT", "PRESENT"],
  });
  const certificatePath = "src/lib/browser/infrastructure/browser-authority-certificate.ts";
  const certificate = requireAstSource(context, findings, checkId, laws.auth, certificatePath);
  if (!certificate) return;
  if (!hasPrivateConstructor(certificate)) {
    addBrowserFinding(findings, checkId, laws.auth, certificatePath, "authority certificate constructor must stay private");
  }
};

const inspectCompositionGate = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const checkId = "local-browser-session/composition-authority-gate";
  const assemblyPath = "src/lib/local-runtime/workbench-assembly.ts";
  const assembly = requireAstSource(context, findings, checkId, laws.auth, assemblyPath);
  if (assembly) {
    requireAstFacts({
      source: assembly,
      findings,
      checkId,
      law: laws.auth,
      filePath: assemblyPath,
      identifiers: ["createWorkbenchBrowserAuthority", "createWorkbenchAiInputGateway", "browserAuthority"],
    });
    assertCallOrder({
      source: assembly,
      findings,
      checkId,
      law: laws.auth,
      filePath: assemblyPath,
      first: "createWorkbenchBrowserAuthority",
      second: "createWorkbenchAiInputGateway",
      message: "AI Gateway must be constructed after the authenticated BrowserController gate",
    });
  }
  const supportPath = "src/lib/local-runtime/workbench-browser-support.ts";
  const support = requireAstSource(context, findings, checkId, laws.auth, supportPath);
  if (support) requireAstFacts({
    source: support,
    findings,
    checkId,
    law: laws.auth,
    filePath: supportPath,
    identifiers: ["createWorkbenchBrowserAuthority", "resolveProductionBrowserProfileEnrollment", "BrowserInfrastructureSupervisorImpl"],
  });
  const serverPath = "src/app/server.ts";
  const server = requireAstSource(context, findings, checkId, laws.auth, serverPath);
  if (server) assertCallOrder({
    source: server,
    findings,
    checkId,
    law: laws.auth,
    filePath: serverPath,
    first: "init",
    second: "startServer",
    message: "HTTP server must not listen before Workbench authority initialization succeeds",
  });
};

const inspectMutualAuthorityCommit = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const checkId = "local-browser-session/authority-mutual-commit";
  const cases = [
    ["src/lib/browser/infrastructure/browser-authority-issuer.ts", ["prepare", "commit", "pending"], []],
    ["src/lib/browser/transport/transport-authenticator.ts", ["handleGrantAck", "verifyBrowserTranscriptProof", "commit"], ["authority_grant_ack"]],
    ["src/lib/browser/chrome-extension/service-worker-native-port-actor.ts", ["verifyControllerProof", "authority", "binding"], ["authority_grant_ack"]],
  ] as const;
  for (const [filePath, identifiers, strings] of cases) {
    const source = requireAstSource(context, findings, checkId, laws.auth, filePath);
    if (!source) continue;
    requireAstFacts({ source, findings, checkId, law: laws.auth, filePath, identifiers, strings });
  }
  const transportPath = cases[1][0];
  const transport = context.project.getSourceFile(transportPath);
  if (transport) assertCallOrder({
    source: transport,
    findings,
    checkId,
    law: laws.auth,
    filePath: transportPath,
    first: "verifyBrowserTranscriptProof",
    second: "commit",
    message: "Controller must verify the Extension grant ACK proof before committing authority",
  });
  const extensionPath = cases[2][0];
  const extension = context.project.getSourceFile(extensionPath);
  if (extension) assertStringBeforeAssignment({
    source: extension,
    findings,
    checkId,
    law: laws.auth,
    filePath: extensionPath,
    stringValue: "authority_grant_ack",
    assignmentPath: "this.authority",
    scopeName: "handleAuthorityGrant",
    message: "Extension must emit grant ACK before exposing local authority to command execution",
  });
};

const inspectRevocationAndActor = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const transportPath = "src/lib/browser/transport/transport-actor.ts";
  const transport = requireAstSource(
    context, findings, "local-browser-session/authority-revoke-before-side-effects", laws.auth, transportPath,
  );
  if (transport) {
  for (const scopeName of ["terminate", "onClose"]) assertCallOrder({
      source: transport,
      findings,
      checkId: "local-browser-session/authority-revoke-before-side-effects",
      law: laws.auth,
      filePath: transportPath,
      scopeName,
      first: "revokeFirst",
      second: "failPending",
      message: `${scopeName} must revoke authority before rejecting pending commands`,
    });
  }
  const actorPath = "src/lib/browser/chrome-extension/service-worker-native-port-actor.ts";
  const actor = requireAstSource(
    context, findings, "local-browser-session/native-port-actor-generation-fence", laws.auth, actorPath,
  );
  if (!actor) return;
  requireAstFacts({
    source: actor,
    findings,
    checkId: "local-browser-session/native-port-actor-generation-fence",
    law: laws.auth,
    filePath: actorPath,
    identifiers: ["NativePortActor", "nativePortEpoch", "extensionInstanceId", "postMessage", "commandReceipts"],
  });
  forbidAstFacts({
    source: actor,
    findings,
    checkId: "local-browser-session/native-port-actor-generation-fence",
    law: laws.auth,
    filePath: actorPath,
    identifiers: ["authenticatedNonce"],
  });
};

const inspectPermitAndLiveness = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const bindingCheck = "local-browser-session/command-permit-frame-binding";
  const bindingCases = [
    ["src/lib/browser/transport/command-permit.ts", ["authorityRef", "authorityEpoch", "executionBindingHash", "writerFenceHash", "targetLeaseRef", "documentRef", "permitHash"], []],
    ["src/lib/browser/transport/transport-frame-crypto.ts", ["createECDH", "hkdfSync", "createCipheriv", "setAAD"], ["prime256v1", "sha256", "aes-256-gcm"]],
    ["src/lib/browser/exact-target/browser-command-actor.ts", ["issueBrowserCommandPermit", "encryptBrowserFrame", "handleResponse", "permitHash"], []],
  ] as const;
  for (const [filePath, identifiers, strings] of bindingCases) {
    const source = requireAstSource(context, findings, bindingCheck, laws.auth, filePath);
    if (source) requireAstFacts({ source, findings, checkId: bindingCheck, law: laws.auth, filePath, identifiers, strings });
  }
  const livenessCheck = "local-browser-session/authority-liveness";
  const issuerPath = "src/lib/browser/infrastructure/browser-authority-issuer.ts";
  const issuer = requireAstSource(context, findings, livenessCheck, laws.auth, issuerPath);
  if (issuer) {
    requireAstFacts({
      source: issuer,
      findings,
      checkId: livenessCheck,
      law: laws.auth,
      filePath: issuerPath,
      identifiers: ["BROWSER_MAX_AUTHORITY_AGE_MS", "heartbeat", "requireCurrent", "revokeIfExpired"],
    });
  }
  const transportPath = "src/lib/browser/transport/transport-actor.ts";
  const transport = requireAstSource(context, findings, livenessCheck, laws.auth, transportPath);
  if (transport) requireAstFacts({
    source: transport,
    findings,
    checkId: livenessCheck,
    law: laws.auth,
    filePath: transportPath,
    identifiers: ["setInterval", "watchAuthority"],
    numbers: [250],
  });
  const authenticationPath = "src/lib/browser/transport/transport-authenticator.ts";
  const authentication = requireAstSource(context, findings, livenessCheck, laws.auth, authenticationPath);
  if (authentication) requireAstFacts({
    source: authentication,
    findings,
    checkId: livenessCheck,
    law: laws.auth,
    filePath: authenticationPath,
    identifiers: ["handleHeartbeat", "heartbeat", "issuer"],
    strings: ["BROWSER_AUTHORITY_LIVENESS_EXPIRED"],
  });
};

const inspectExecutorAndEvaluation = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const executorCheck = "local-browser-session/extension-only-executor";
  const protocolPath = "src/lib/browser/protocol/generated/browser-protocol.ts";
  const workerPath = "src/lib/browser/chrome-extension/service-worker.ts";
  for (const filePath of [protocolPath, workerPath]) {
    const source = requireAstSource(context, findings, executorCheck, laws.executor, filePath);
    if (!source) continue;
    forbidAstFacts({
      source,
      findings,
      checkId: executorCheck,
      law: laws.executor,
      filePath,
      identifiers: ["PhysicalFocusLease"],
      strings: ["focus_target", "native_file_picker", "os_pointer_action", "os_keyboard_action"],
    });
  }
  const runtimePath = "src/lib/browser/exact-target/exact-browser-target-session.ts";
  const runtime = requireAstSource(context, findings, "local-browser-session/side-effect-free-observation", laws.evaluate, runtimePath);
  if (runtime) requireAstFacts({
    source: runtime,
    findings,
    checkId: "local-browser-session/side-effect-free-observation",
    law: laws.evaluate,
    filePath: runtimePath,
    identifiers: ["toBrowserEvaluationExpression"],
    strings: ["observation"],
  });
  const worker = context.project.getSourceFile(workerPath);
  if (worker) requireAstFacts({
    source: worker,
    findings,
    checkId: "local-browser-session/side-effect-free-observation",
    law: laws.evaluate,
    filePath: workerPath,
    identifiers: ["throwOnSideEffect", "allowSideEffects", "observeNamedCapability"],
    strings: ["observe_capability", "click_target", "click_dom_target", "fill_dom_target", "scroll_target", "Input.dispatchMouseEvent"],
  });
  const interactionPath = "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts";
  const interaction = requireAstSource(context, findings, "local-browser-session/dedicated-mutation-surface", laws.evaluate, interactionPath);
  if (interaction) requireAstFacts({
    source: interaction,
    findings,
    checkId: "local-browser-session/dedicated-mutation-surface",
    law: laws.evaluate,
    filePath: interactionPath,
    strings: ["text_target", "stage_file_artifact_chunk", "set_file_input_artifact", "Input.insertText"],
  });
};

const inspectFileGrant = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  const checkId = "local-browser-session/file-artifact-grant";
  const grantPath = "src/lib/browser/exact-target/browser-file-artifact-grant.ts";
  const grant = requireAstSource(context, findings, checkId, laws.executor, grantPath);
  if (grant) requireAstFacts({
    source: grant,
    findings,
    checkId,
    law: laws.executor,
    filePath: grantPath,
    identifiers: ["sourcePath", "approvedRoots", "deviceIdHash", "inodeHash", "contentHash"],
  });
  const protocolPath = "src/lib/browser/protocol/generated/browser-protocol.ts";
  const protocol = requireAstSource(context, findings, checkId, laws.executor, protocolPath);
  if (protocol) {
    requireAstFacts({
      source: protocol,
      findings,
      checkId,
      law: laws.executor,
      filePath: protocolPath,
      identifiers: ["BrowserWireFileGrant", "fileGrant"],
      strings: ["set_file_input_artifact"],
    });
    const rawPathVariant = protocol.getDescendantsOfKind(SyntaxKind.TypeLiteral).some((typeLiteral) => {
      const hasKind = typeLiteral.getProperties().some((property) => property.getName() === "kind"
        && property.getDescendantsOfKind(SyntaxKind.StringLiteral)
          .some((literal) => literal.getLiteralValue() === "set_file_input_artifact"));
      return hasKind && typeLiteral.getProperties().some((property) => property.getName() === "filePath");
    });
    if (rawPathVariant) addBrowserFinding(findings, checkId, laws.executor, protocolPath, "wire contract must not accept raw filePath for set_file_input_artifact");
  }
  const interactionPath = "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts";
  const interaction = requireAstSource(context, findings, checkId, laws.executor, interactionPath);
    if (interaction && (!sourceHasIdentifier(interaction, "fileGrant") || !sourceHasIdentifier(interaction, "grantRef"))) {
    addBrowserFinding(findings, checkId, laws.executor, interactionPath, "file input must consume the bounded artifact grant identity");
  }
};

export const inspectBrowserAuthorityCore = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: CoreLaws,
): void => {
  inspectExactTarget(context, findings, laws);
  inspectNoUnauthenticatedSession(context, findings, laws);
  inspectCompositionGate(context, findings, laws);
  inspectMutualAuthorityCommit(context, findings, laws);
  inspectRevocationAndActor(context, findings, laws);
  inspectPermitAndLiveness(context, findings, laws);
  inspectExecutorAndEvaluation(context, findings, laws);
  inspectFileGrant(context, findings, laws);
};
