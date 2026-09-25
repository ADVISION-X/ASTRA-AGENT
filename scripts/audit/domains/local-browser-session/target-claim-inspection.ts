import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  brokerPath,
  createLocalFinding,
  extensionCreatedTargetPath,
  extensionDebuggerRuntimePath,
  requireIdentifiers,
  requireSource,
  sourcePaths,
  stringLiterals,
  targetAuthorityPath,
} from "./inspector-support.js";

const targetClaimAwaiterPath = "src/lib/browser/chrome-extension/websocket-target-claim-awaiter.ts";
const sitePolicyPath = "src/lib/browser/exact-target/browser-site-policy-registry.ts";
const targetLeaseManagerPath = "src/lib/browser/exact-target/browser-target-lease-manager.ts";
const targetLeasePath = "src/lib/browser/exact-target/browser-target-lease.ts";
const laneCoordinatorPath = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
const mutationStorePath = "src/lib/browser/exact-target/browser-mutation-store.ts";
const mutationEvidencePath = "src/lib/browser/exact-target/browser-mutation-evidence.ts";
const targetAcquirerPath = "src/lib/browser/infrastructure/browser-target-acquirer.ts";
const framePayloadPath = "src/lib/browser/transport/browser-authority-frame-payload.ts";
const targetAcquisitionPath = "src/lib/browser/chrome-extension/extension-target-acquisition.ts";
const targetReleasePath = "src/lib/browser/chrome-extension/extension-target-release.ts";

const inspectJobBoundClaimOrder = (actor: ReturnType<typeof requireSource>, findings: InspectorFinding[], lawId: string): void => {
  const actorClass = actor?.getClass("ExtensionWebSocketActor");
  const messageText = actorClass?.getMethod("onMessage")?.getText() ?? "";
  const readyStart = messageText.indexOf('if (frame.kind === "READY")');
  const readyEnd = messageText.indexOf('if (frame.kind === "TARGET_ACQUIRE")', readyStart);
  const readyText = readyStart >= 0 && readyEnd > readyStart
    ? messageText.slice(readyStart, readyEnd) : "";
  const acquisitionText = actorClass?.getMethod("acceptTargetAcquire")?.getText() ?? "";
  const decryptIndex = acquisitionText.indexOf("await decrypt(");
  const claimIndex = acquisitionText.indexOf("this.targetAuthority.acquireJobBoundChatGptTarget(");
  const awaitIndex = acquisitionText.indexOf("await handler;", claimIndex);
  if (readyText.indexOf("readServerReadyPermit(this.session, frame, AUTH_EPOCH)") >= 0
    && readyText.indexOf("this.commandReady = true") > readyText.indexOf("readServerReadyPermit(")
    && !readyText.includes("acquireJobBoundChatGptTarget")
    && acquisitionText.includes("!this.commandReady")
    && decryptIndex >= 0
    && claimIndex > decryptIndex
    && acquisitionText.includes("this.pendingTargetHandlers.add(handler)")
    && awaitIndex > claimIndex
    && acquisitionText.includes("this.pendingTargetHandlers.delete(handler)")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[1],
    message: "READY must leave Target absent; only one authenticated TARGET_ACQUIRE may invoke the exact target owner.",
  }));
};

const inspectServerClaimOrder = (serverClaim: string, findings: InspectorFinding[], lawId: string): void => {
  const policyIndex = serverClaim.indexOf("requireGptWebClaimOrigin(input.claimOrigin)");
  const workspaceIndex = serverClaim.indexOf("this.establishClaimBoundWorkspace()");
  if (policyIndex >= 0 && workspaceIndex > policyIndex) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[3],
    message: "The server must validate the exact ChatGPT policy before Session Workspace establishment.",
  }));
};

const inspectBrokerClaimMonotonicity = (brokerText: string, findings: InspectorFinding[], lawId: string): void => {
  if (brokerText.includes("current.targetRef !== claim.targetRef")
    && brokerText.includes("current.jobRefHash !== claim.jobRefHash")
    && brokerText.includes("claim.jobRefHash !== binding.jobRefHash")
    && brokerText.includes("claim.navigationEpoch !== current.navigationEpoch + 1")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: brokerPath,
    message: "The Broker must reject cross-job target reuse, target replacement and non-monotonic Document claims on one authority epoch.",
  }));
};

const inspectNonDestructiveTargetRelease = (
  context: InspectorContext,
  leaseManager: ReturnType<typeof requireSource>,
  lane: ReturnType<typeof requireSource>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const method = leaseManager?.getClass("BrowserTargetLeaseManager")?.getMethod("createTargetLease")?.getText() ?? "";
  const admission = leaseManager?.getClass("BrowserTargetLeaseManager")
    ?.getMethod("assertCommandAdmission")?.getText() ?? "";
  const lifecycle = lane?.getClass("BrowserLaneCoordinator")?.getMethod("withLifecycle")?.getText() ?? "";
  const laneText = lane?.getFullText() ?? "";
  const destructiveClose = context.project.getSourceFiles().some((source) =>
    source.getFilePath().includes("/src/lib/browser/")
    && stringLiterals(source).some((literal) => literal === "Page.close" || literal === "browser.close-target.v1"));
  const parkAt = method.indexOf("park: async");
  const settlementModeAt = method.indexOf('mode !== "product-call-settlement"', parkAt);
  const physicalParkAt = method.indexOf('command("browser.park-target.v1"', parkAt);
  const requiredReleaseFacts = [
    "pendingMutationCount: () => state.pendingMutationCommandIds.length",
  ].every((token) => method.includes(token));
  const forbiddenReleaseFacts = ["close: async"].some((token) => method.includes(token));
  const requiredLaneFacts = [
    "const mutationBlocked = this.hasUnresolvedMutation()",
    "waiter.kind === \"acquire\"", "countDispatched(waiter.jobId)", "index += 1",
  ].every((token) => laneText.includes(token))
    && !laneText.includes("settleRetiredTargetLocal")
    && !laneText.includes("allDispatchedTargetsSettled");
  const forbiddenPermanentRevocation = laneText.includes('website-permanent-revocation');
  const lifecycleSettles = lifecycle.includes("finally")
    && lifecycle.indexOf("this.active = false") > lifecycle.indexOf("finally");
  if ([parkAt >= 0, settlementModeAt > parkAt, physicalParkAt > settlementModeAt,
    requiredReleaseFacts, !forbiddenReleaseFacts, !destructiveClose,
    admission.includes('value.kind !== "park-target"'), lifecycleSettles,
    requiredLaneFacts, !forbiddenPermanentRevocation,
    !lifecycle.includes("revokeOperatorTargetClaim")].every(Boolean)) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/dispatched-mutation-target-release", lawId, filePath: targetLeaseManagerPath,
    message: "The one lane must block new physical work while any Browser WAL command remains DISPATCHED.",
  }));
};

const inspectExactChatGptPolicy = (source: ReturnType<typeof requireSource>, findings: InspectorFinding[], lawId: string): void => {
  const text = source?.getFullText() ?? "";
  const claimOrigin = source?.getVariableDeclaration("requireGptWebClaimOrigin")?.getText() ?? "";
  if (text.includes('export const GPT_WEB_ORIGIN = "https://chatgpt.com" as const')
    && text.includes('export const GPT_WEB_START_URL = "https://chatgpt.com/" as const')
    && /siteId: "gpt-web",\s*allowedOrigins: \[GPT_WEB_ORIGIN\]/u.test(text)
    && claimOrigin.includes("value !== GPT_WEB_ORIGIN")) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sitePolicyPath,
    message: "The gpt-web policy must own one exact https://chatgpt.com/ start URL.",
  }));
};

const acquisitionUsesOnlyCurrentTargetBeforeCreating = (acquisition: string, preflight: string): boolean =>
  acquisition.includes('targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation"')
  && preflight.includes('findByJobRefHash(input.jobRefHash)')
  && preflight.includes('if (!requestValid || input.activeTarget || input.createdTarget.isPending())')
  && !preflight.includes('expectedTargetRef')
  && acquisition.includes('if (bound && await this.reacquireParkedTarget(')
  && acquisition.includes('const candidate = await this.createdTarget.createProductionCandidate()')
  && acquisition.indexOf('await preflightTargetAcquisition(')
    < acquisition.indexOf('if (bound && await this.reacquireParkedTarget(')
  && acquisition.indexOf('if (bound && await this.reacquireParkedTarget(')
    < acquisition.indexOf('const candidate = await this.createdTarget.createProductionCandidate()');

const inspectTargetAcquisitionReadback = (
  targetAuthority: NonNullable<ReturnType<typeof requireSource>>,
  targetAcquisition: NonNullable<ReturnType<typeof requireSource>>,
  findings: InspectorFinding[], lawId: string,
): void => {
  const targetClass = targetAuthority.getClass("ExtensionTargetAuthority");
  const acquisition = targetClass?.getMethod("acquireJobBoundChatGptTargetCycle")?.getText() ?? "";
  const reacquire = targetClass?.getMethod("reacquireParkedTarget")?.getText() ?? "";
  const selection = targetClass?.getMethod("executeConversationSelection")?.getText() ?? "";
  if (!acquisitionUsesOnlyCurrentTargetBeforeCreating(acquisition, targetAcquisition.getFullText())
    || !readbackUsesCurrentTargetAndCanonicalUrl(reacquire, selection)
    || targetAuthority.getFullText().includes("readOrRecoverExactTarget")) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: targetAuthorityPath,
    message: "Confirmed readback must use the current system Target and one exact canonical URL navigation without scanning historical Targets or foregrounding the Tab.",
  }));
};

const inspectExactTargetRelease = (
  targetAuthority: NonNullable<ReturnType<typeof requireSource>>,
  targetRelease: NonNullable<ReturnType<typeof requireSource>>,
  findings: InspectorFinding[], lawId: string,
): void => {
  const delegate = targetAuthority.getClass("ExtensionTargetAuthority")
    ?.getMethod("releaseJobBoundChatGptTarget")?.getText() ?? "";
  const release = targetRelease.getVariableDeclaration("releaseJobBoundTarget")?.getText() ?? "";
  const delegateBound = ["await releaseJobBoundTarget({", "targets: this.targets",
    "createdTarget: this.createdTarget", "readActiveJobRefHash: () => this.activeTarget?.jobRefHash",
    "awaitOldCommandHandlers: this.awaitOldCommandHandlers",
    'sendRevoke: (body) => this.send("TARGET_REVOKE", body)',
    "}, jobRefHash)"].every((token) => delegate.includes(token));
  const releaseBound = ["await context.awaitOldCommandHandlers()",
    "await context.debuggerRuntime.awaitPageReadPermission()",
    "context.readActiveJobRefHash() === jobRefHash", "findByJobRefHash(jobRefHash)",
    "target.id === bound.chromeTargetId", "await context.debuggerRuntime.removeTab(bound.tabId)",
    "await context.debuggerRuntime.readTab(bound.tabId)",
    "await context.debuggerRuntime.readTargets()", 'releaseOutcome: "released"',
  ].every((token) => release.includes(token));
  if (delegateBound && releaseBound && !release.includes("targetRefs")) return;
  findings.push(createLocalFinding({ checkId: "browser-authority/job-bound-target-claim",
    lawId, filePath: targetReleasePath,
    message: "Current Target release must verify live Chrome identity and physical absence without historical refs.",
  }));
};

const readbackUsesCurrentTargetAndCanonicalUrl = (reacquire: string, selection: string): boolean =>
  reacquire.includes('activateTab(parked.tabId)')
  && selection.includes('"Page.navigate", { url: expected }')
  && selection.includes("publishMainFrameNavigation(mainFrame.url, mainFrame.loaderId, true)")
  && reacquire.includes("debuggerRuntime.readTargets()")
  && !selection.includes("debuggerRuntime.readTargets()")
  && !selection.includes("nav a[href")
  && !selection.includes("tabs.query")
  && !selection.includes("Page.bringToFront");

const inspectCanonicalConversationPolicy = (
  sitePolicyText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const required of ["requireCanonicalGptConversationUrl", 'segments[1] === "c"',
    'url.search !== ""', 'url.hash !== ""']) if (!sitePolicyText.includes(required)) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/canonical-gpt-conversation", lawId,
      filePath: sitePolicyPath,
      message: `The Browser-owned canonical conversation policy is missing ${required}.`,
    }));
  }
};

const inspectExactParentStepContinuation = (
  sourceText: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const required of ["parentAttemptId?: never", "parentAttemptId: wait.parentAttemptId",
    "waiter.parentAttemptId!, waiter.binding.productStepId", "parentAttemptId: string",
    "where job_id=? and attempt_id=? and product_step_id=?",
    "product_step_id=? and call_id='turn-submit'",
    "child_capability_id='submit_exact_gpt_turn_once'", "rows.length !== 1",
    ").all(parentJobId, parentAttemptId, parentProductStepId)"])
    if (!sourceText.includes(required)) findings.push(createLocalFinding({
      checkId: "browser-authority/exact-parent-step-continuation", lawId, filePath: mutationStorePath,
      message: `Authorized continuation is missing exact completed-parent-attempt fact ${required}.`,
    }));
};

const inspectProductionTabContract = (
  debuggerRuntime: ReturnType<typeof requireSource>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const productionTabCreation = debuggerRuntime?.getClass("ExtensionDebuggerRuntime")
    ?.getMethod("createProductionTab")?.getText() ?? "";
  const productionTabContract = [
    productionTabCreation.includes("this.chromeApi.tabs.create({ active: true, url })"),
    !productionTabCreation.includes("active: false"),
    !debuggerRuntime?.getFullText().includes("createBackgroundTab"),
  ].every(Boolean);
  if (!productionTabContract) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim",
    lawId,
    filePath: extensionDebuggerRuntimePath,
    message: "The sole production Tab creation path must select the new system Tab with active=true and physically delete the background-tab contract.",
  }));
};

const inspectJobBoundClaimPolicy = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const targetAuthority = requireSource(context, findings, lawId, targetAuthorityPath);
  const createdTarget = requireSource(context, findings, lawId, extensionCreatedTargetPath);
  const targetAcquisition = requireSource(context, findings, lawId, targetAcquisitionPath);
  const targetRelease = requireSource(context, findings, lawId, targetReleasePath);
  const debuggerRuntime = requireSource(context, findings, lawId, extensionDebuggerRuntimePath);
  const sitePolicy = requireSource(context, findings, lawId, sitePolicyPath);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const broker = requireSource(context, findings, lawId, brokerPath);
  const leaseManager = requireSource(context, findings, lawId, targetLeaseManagerPath);
  const leaseContract = requireSource(context, findings, lawId, targetLeasePath);
  const lane = requireSource(context, findings, lawId, laneCoordinatorPath);
  const mutationStore = requireSource(context, findings, lawId, mutationStorePath);
  const mutationEvidence = requireSource(context, findings, lawId, mutationEvidencePath);
  const targetAcquirer = requireSource(context, findings, lawId, targetAcquirerPath);
  if (![targetAuthority, createdTarget, targetAcquisition, targetRelease, debuggerRuntime, sitePolicy, actor, supervisor, broker,
    leaseManager, leaseContract, lane, mutationStore, mutationEvidence, targetAcquirer].every(Boolean)) return;
  requireIdentifiers(targetAuthority!, [
    "acquireJobBoundChatGptTarget", "GPT_WEB_START_URL",
    "requireGptWebPolicyForUrl", "navigationPublication",
    "parkActiveTarget", "releaseJobBoundChatGptTarget", "jobRefHash",
    "publishMainFrameNavigation", "activateTab",
  ], findings, lawId, "The fixed extension must create, validate, retain and release one exact system Target per active GPT job.");
  requireIdentifiers(createdTarget!, ["createProductionTab", "removeTab", "waitForCreatedTarget"],
    findings, lawId, "Created Target identity and orphan cleanup must remain in the Browser Owner.");
  requireIdentifiers(targetAcquisition!, ["findByJobRefHash", "createdTarget"],
    findings, lawId, "Target acquisition must inspect only the current live registry.");
  inspectProductionTabContract(debuggerRuntime!, findings, lawId);
  requireIdentifiers(supervisor!, [
    "requireGptWebClaimOrigin", "establishClaimBoundWorkspace", "pendingJobBoundTargetAcquisition",
    "acquireJobBoundTargetLease",
  ], findings, lawId,
  "The server must bind initial Target acquisition to one current job request before establishing Session Workspace.");
  requireIdentifiers(lane!, ["BrowserTargetAcquirer", "targetAcquirer", "ensureAvailableTarget"], findings, lawId,
    "The sole Browser lane must delegate target acquisition to its one private target acquirer.");
  const requestClassificationPrivate = !leaseContract!.getFullText().includes("requestKind")
    && lane!.getFullText().includes('requestKind: wait.targetMode === "fresh"');
  if (!requestClassificationPrivate) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/job-bound-target-claim", lawId, filePath: targetLeasePath,
      message: "The public lease wait contract must not expose requestKind; the Browser lane must derive it from the governed target mode.",
    }));
  }
  requireIdentifiers(targetAcquirer!, [
    "acquireJobBoundTarget", "requestPreauthorizedTargetAcquisition", "pendingJobBoundTargetAcquisition",
    "releaseJobBoundTarget", "requestPreauthorizedTargetRelease", "targetMode", "jobRefHash",
    "currentOperatorTargetJobRefHash", "resolvePending", "rejectPending",
  ], findings, lawId, "The target acquirer must bind acquire/release to the current queued job and explicit fresh/observation/readback mode.");
  requireIdentifiers(broker!, ["current", "targetRef", "navigationEpoch", "jobRefHash",
    "currentOperatorTargetJobRefHash"], findings, lawId,
    "The sole Broker must reject cross-job target reuse, target replacement and non-monotonic Document claims.");
  inspectJobBoundClaimOrder(actor!, findings, lawId);
  inspectServerClaimOrder(supervisor!.getClass("BrowserInfrastructureSupervisor")?.getMethod("onTargetClaim")?.getText() ?? "", findings, lawId);
  inspectBrokerClaimMonotonicity(broker!.getFullText(), findings, lawId);
  inspectTargetAcquisitionReadback(targetAuthority!, targetAcquisition!, findings, lawId);
  inspectExactTargetRelease(targetAuthority!, targetRelease!, findings, lawId);
  inspectNonDestructiveTargetRelease(context, leaseManager!, lane!, findings, lawId);
  inspectExactChatGptPolicy(sitePolicy!, findings, lawId);
  inspectCanonicalConversationPolicy(sitePolicy!.getFullText(), findings, lawId);
  inspectExactParentStepContinuation(
    `${leaseContract!.getFullText()}\n${lane!.getFullText()}\n${mutationStore!.getFullText()}\n${mutationEvidence!.getFullText()}`,
    findings,
    lawId,
  );
};

/** TARGET_CLAIM carries only claimOrigin identity and parses epoch zero as a valid first claim. */
const inspectTargetClaimPayload = (framePayload: SourceFile, findings: InspectorFinding[], lawId: string): void => {
  const parseClaim = framePayload.getVariableDeclaration("parseBrowserAuthorityTargetClaim");
  const parseClaimText = parseClaim?.getText() ?? "";
  const originFinding = (message: string) => createLocalFinding({
    checkId: "browser-authority/target-claim-origin-only", lawId, filePath: framePayloadPath, message,
  });
  for (const required of [
    'stringField(body, "claimOrigin")', "requireGptWebClaimOrigin(claimOrigin)",
    '["targetRef", "documentRef", "navigationEpoch", "claimOrigin", "jobRefHash"]',
  ]) if (!parseClaimText.includes(required)) {
    findings.push(originFinding(`TARGET_CLAIM must carry exact claimOrigin only; missing ${required}.`));
  }
  if (/stringField\(body,\s*["'](?:url|currentUrl)["']\)/u.test(parseClaimText)) {
    findings.push(originFinding("TARGET_CLAIM must not carry current or canonical conversation URL."));
  }
  const epochCall = parseClaim?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "navigationEpoch")
    ?.getInitializerIfKind(SyntaxKind.CallExpression);
  const integerParser = framePayload.getVariableDeclaration("integerField")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const epochArguments = epochCall?.getArguments().map((argument) => argument.getText()) ?? [];
  if (!epochCall || !Node.isIdentifier(epochCall.getExpression())
    || astIdentifierName(epochCall.getExpression()) !== "integerField"
    || JSON.stringify(epochArguments) !== JSON.stringify(["body", '"navigationEpoch"'])
    || integerParser?.getParameters()[2]?.getInitializer()?.getText() !== "0"
    || !integerParser.getBody().getText().includes("Number.isSafeInteger(value)")
    || !integerParser.getBody().getText().includes("value < minimum")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority", lawId, filePath: framePayloadPath,
      message: "The first target claim must parse navigationEpoch with the non-negative integer boundary so epoch zero remains valid.",
    }));
  }
};

export const inspectTargetClaimGuards = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const channel = requireSource(context, findings, lawId, sourcePaths[0]);
  const framePayload = requireSource(context, findings, lawId, framePayloadPath);
  const actor = requireSource(context, findings, lawId, sourcePaths[1]);
  const awaiter = requireSource(context, findings, lawId, targetClaimAwaiterPath);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const leaseContract = requireSource(context, findings, lawId, targetLeasePath);
  if (!channel || !framePayload || !actor || !awaiter || !supervisor || !leaseContract) return;
  requireIdentifiers(channel, ["sendTargetClaimAcknowledgement", "parseBrowserAuthorityTargetClaim"], findings, lawId,
    "Workbench target admission must accept epoch zero and return one encrypted acknowledgement.");
  requireIdentifiers(framePayload, ["parseBrowserAuthorityTargetClaim", "integerField"], findings, lawId,
    "The Target claim payload owner must validate the complete exact wire identity.");
  if (!channel.getFullText().includes('integerField(body, "requestSequence", 1)')
    || !channel.getFullText().includes('integerField(body, "permitSequence", 1)')) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority", lawId, filePath: sourcePaths[0],
    message: "Socket request and permit sequences must retain the positive integer boundary.",
  }));
  requireIdentifiers(actor, ["TargetClaimAwaiter", "targetClaims", "sendTargetFrame", "acceptTargetClaimAcknowledgement"], findings, lawId,
    "The extension actor must route target claims through the one acknowledgement awaiter.");
  requireIdentifiers(actor, ["acceptTargetAcquire", "acquireJobBoundChatGptTarget"], findings, lawId,
    "The authenticated job-bound frame must trigger the fixed extension target owner and report a non-fatal diagnostic on failure.");
  if (!stringLiterals(actor).includes("job-bound-target-acquisition")) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[1],
    message: "Job-bound target acquisition failure must remain a non-fatal authenticated diagnostic.",
  }));
  requireIdentifiers(awaiter, ["TargetClaimAwaiter", "begin", "accept", "fail"], findings, lawId,
    "The extension must not report target success before the Workbench acknowledgement.");
  inspectTargetClaimPayload(framePayload, findings, lawId);
  if (/GRASSEYE_CLAIM_ACTIVE_TARGET|claimActiveTarget/u.test(actor.getFullText())) findings.push(createLocalFinding({
    checkId: "browser-authority/job-bound-target-claim", lawId, filePath: sourcePaths[1],
    message: "The retired manual active-tab claim handler must be physically absent.",
  }));
  const supervisorText = supervisor.getFullText();
  const hostRestoreContract = ["shouldRestoreBrowserHostVisibility",
    'reasonCode === "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"', '"peer_close", "tcp_close", "tcp_error"',
    'this.issuer.current().kind === "PRESENT"', "void this.restoreBrowserHostVisibility()",
    '"BROWSER_HOST_UNAVAILABLE", "browser-host-restore"'].every((token) => supervisorText.includes(token));
  if (!hostRestoreContract || leaseContract.getFullText().includes("attempt-replaced")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/authenticated-transport-host-restore",
      lawId,
      filePath: sourcePaths[3],
      message: "Only an authenticated Browser transport terminal may invoke the existing host restore callback, and the retired attempt-replaced release authority must remain absent.",
    }));
  }
  inspectJobBoundClaimPolicy(context, findings, lawId);
};
