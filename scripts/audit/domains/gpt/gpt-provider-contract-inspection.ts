import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { sourceFor, type FindingFactory } from "./gpt-inspection-support.js";
import { textResponseTwoGateSettlementIsFrozen } from "./gpt-frozen-attempt-inspection.js";

const ROOT = "src/capabilities/gpt", LANE = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
const LIFECYCLE = `${ROOT}/production-browser-lifecycle.ts`, TEXT = `${ROOT}/children/checkpoint_gpt_text_response/handler.ts`;
const IMAGE = `${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`, TOOLS = `${ROOT}/production-child-tools.ts`, ARTIFACTS = `${ROOT}/evidence-artifacts.ts`;
const text = (context: InspectorContext, path: string): string => sourceFor(context, path)?.getFullText() ?? "";
const check = (valid: boolean, id: string, path: string, message: string, findings: InspectorFinding[], finding: FindingFactory): void => {
  if (!valid) findings.push(finding(id, path, message));
};
const calls = (node: Node | undefined, expression: string) => node?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === expression) ?? [];
const before = (body: string, first: string, last: string): boolean => body.indexOf(first) >= 0 && body.indexOf(last) > body.indexOf(first);
const objectKeys = (node: Node | undefined): string[] => Node.isObjectLiteralExpression(node) ? node.getProperties().flatMap(property =>
  Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property) ? [property.getName()] : []).sort() : [];
const inspectObservationLane = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const lane = sourceFor(context, LANE), owner = lane?.getClass("BrowserLaneCoordinator"), laneText = lane?.getFullText() ?? "";
  const parkText = owner?.getMethod("withLifecycle")?.getText() ?? "";
  const lifecycle = sourceFor(context, LIFECYCLE), lifecycleText = lifecycle?.getFullText() ?? "";
  check(laneText.includes("private readonly queue: LaneWaiter[] = []")
    && owner?.getMethod("nextWaiter")?.getText().includes("waiter.eligibleAt <= now") === true
    && owner?.getMethod("scheduleWake")?.getText().includes("Math.min(expiresAt, waiter.eligibleAt)") === true
    && calls(lane, "Math.random").length === 0
    && !/observationNotBefore|requestKind|notifyProviderObservationTerminal/u.test(laneText)
    && lifecycle?.getVariableDeclaration("PROVIDER_OBSERVATION_MIN_INTERVAL_MS")?.getInitializer()?.getText() === "70_000"
    && owner?.getProperties().filter(property => /Timer$/u.test(property.getName())).length === 1,
  "gpt/no-browser-poll-scheduler", LANE, "One FIFO and wake timer serve eligible requests without a cross-job observation clock; each GPT request retains 70 seconds.", findings, finding);
  check(parkText.includes("new Proxy(lease") && !laneText.includes("...lease"), "gpt/live-browser-document", LANE, "The wrapper must retain the live Document getter.", findings, finding);
  check(!existsSync(resolve(context.sealedRoot, `${ROOT}/provider-wait-cross-conversation-cadence.ts`))
    && !/provider-probe|nextProviderProbeEligibleAt|startProviderProbeCooldown|waiter\.purpose/u.test(laneText)
    && !/Math\.random|yieldForProviderProbe|yieldForProviderWait|waitForDelay|yieldAndReacquire|productionGptCrossConversationPollCadence|"provider-probe"|startProviderProbeCooldown/u.test(lifecycleText),
  "gpt/no-second-wait-scheduler", LIFECYCLE, "GPT cannot own a second scheduler or random interval.", findings, finding);
};

const parentSourcesUseOriginalEffects = (context: InspectorContext): boolean => {
  const parent = sourceFor(context, LANE)?.getClass("BrowserLaneCoordinator")?.getMethod("readParentConversationUrl");
  const exactReads = calls(parent, "store.readSourceConfirmedProviderEffect");
  return exactReads.length === 1 && exactReads[0]?.getArguments()[0]?.getText() === "source"
    && parent?.getDescendantsOfKind(SyntaxKind.ForOfStatement).some(loop =>
      loop.getExpression().getText() === "waiter.parentSources" && calls(loop, "store.readSourceConfirmedProviderEffect").length === 1) === true
    && parent.getText().includes("parentUrl !== locator.canonicalConversationUrl")
    && parent.getText().includes("if (!locator)")
    && !text(context, "src/lib/browser/exact-target/browser-mutation-evidence.ts").includes("readUniqueConfirmedConversationUrl");
};

export const inspectGptProviderProbeOwnerContract = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  check(textResponseTwoGateSettlementIsFrozen(text(context, TEXT)),
    "gpt/provider-observation-gate-first", TEXT, "Text readback must execute the sole frozen observation gate and exact response settlement.", findings, finding);
  inspectObservationLane(context, findings, finding);
  const lifecycleOwner = sourceFor(context, LIFECYCLE)?.getClass("ProductionGptBrowserLifecycle");
  const lifecycleText = text(context, LIFECYCLE);
  const wait = lifecycleOwner?.getMethod("waitForProviderObservation"), waitText = wait?.getText() ?? "", settlement = lifecycleOwner?.getMethod("parkActive");
  check(calls(wait, "active.facade.park").length === 1 && calls(settlement, "current.call.browser.park").length === 1
    && ["active.browser.pendingMutationCount() > 0", "const eligibleAt = Date.now() + PROVIDER_OBSERVATION_MIN_INTERVAL_MS",
      'productStepId, callId, observationDeadlineAt, "confirmed-readback", eligibleAt',
      "canonicalConversationUrl: active.confirmedProviderEffect!.canonicalConversationUrl", 'mode: "product-call-settlement"'].every(token => waitText.includes(token))
    && before(waitText, 'if (eligibleAt > observationDeadlineAt) return "deadline"', "await active.facade.park(")
    && before(waitText, "assertConfirmedProviderReadback(active, this.browserAuthority, this.execution.jobId, this.execution.attemptId)", "await active.facade.park(")
    && before(waitText, "await active.facade.park(", "await this.acquireBrowserLease(")
    && before(waitText, "await this.acquireBrowserLease(", 'kind: "selectExactGptConversation"')
    && settlement?.getText().includes('mode: "product-call-settlement"') === true
    && lifecycleOwner?.getMethod("settle")?.getText().includes("this.parkActive(") === true,
  "gpt/provider-observation-park-readback", LIFECYCLE, "Pending observations verify the original effect, park once and reacquire the same conversation after the Browser gate.", findings, finding);
  const tries = wait?.getDescendantsOfKind(SyntaxKind.TryStatement) ?? [];
  const acquisition = tries.find(node => calls(node.getTryBlock(), "this.acquireBrowserLease").length === 1);
  const pendingPark = tries.find(node => calls(node.getTryBlock(), "active.facade.park").length === 1);
  const selection = calls(wait, "active.facade.executeDomIntent")[0];
  const registered = wait?.getBody()?.getChildrenOfKind(SyntaxKind.ExpressionStatement).find(statement => {
    const node = statement.getExpression();
    return Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && node.getLeft().getText() === "this.activeBrowser" && node.getRight().getText() === "current";
  });
  const retired = (node: Node | undefined): boolean => {
    const statements = Node.isBlock(node) ? node.getStatements() : [];
    const gate = statements[0];
    return statements.length === 1 && Node.isIfStatement(gate)
      && gate.getExpression().getText() === "this.activeBrowser === current"
      && gate.getThenStatement().getText() === "this.activeBrowser = null;";
  };
  const acquisitionCatch = acquisition?.getCatchClause()?.getText() ?? "";
  const leaseHandoffIsSafe = (): boolean => !!acquisition && !!selection && !!registered && selection.getStart() > registered.getEnd()
    && registered.getStart() > acquisition.getEnd()
    && calls(acquisition, "active.facade.executeDomIntent").length === 0
    && calls(wait, "active.browser.executeDomIntent").length === 0
    && retired(pendingPark?.getFinallyBlock())
    && retired(settlement?.getDescendantsOfKind(SyntaxKind.TryStatement)[0]?.getFinallyBlock())
    && waitText.includes("if (!current || current.call !== active)")
    && acquisitionCatch.includes('failureCode(error) === "V6_DEADLINE_BUDGET_EXHAUSTED"')
    && acquisitionCatch.includes("!this.execution.abortSignal.aborted && Date.now() >= observationDeadlineAt")
    && calls(acquisition?.getCatchClause(), "failureCode").length === 1
    && acquisition?.getCatchClause()?.getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 1;
  check(leaseHandoffIsSafe(),
  "gpt/provider-observation-park-readback", LIFECYCLE,
  "Lease handoff retires exactly its owner even on failure; selection retains the new lease and Child identity for settlement.", findings, finding);
  check(lifecycleText.includes("active.browser.readAtomicStepOutcome(confirmed.submitIdentity)")
    && lifecycleText.includes('recoverySelectionRequired: targetMode === "confirmed-readback"') && lifecycleText.includes('"bound-observation"')
    && lifecycleText.includes("parentSources: this.execution.providerContinuationParent!.sources"),
  "gpt/historical-provider-effect-authority", LIFECYCLE, "Readback remains bound to the original submit; continuation transports adopted source identities.", findings, finding);
  check(parentSourcesUseOriginalEffects(context),
  "gpt/historical-provider-effect-authority", LANE, "Every adopted source requires exact original WAL readback and one equal canonical locator; child step cannot select a parent.", findings, finding);
};

const inspectImageObservationOrder = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const imageSource = sourceFor(context, IMAGE);
  const imageLoop = imageSource?.getDescendantsOfKind(SyntaxKind.ForStatement).find(loop => calls(loop, "browser.readAuthenticatedMedia").length > 0);
  const imageBody = imageLoop?.getText() ?? "", imageGate = imageLoop?.getDescendantsOfKind(SyntaxKind.IfStatement)
    .find(statement => statement.getExpression().getText().includes("await context.waitForProviderObservation("));
  check(!!imageGate && imageGate.getExpression().getText().endsWith('=== "deadline"')
    && imageGate.getThenStatement().getText().includes('throw executionFailure("failed", "GPT_IMAGE_TIMEOUT")')
    && before(imageBody, "await context.waitForProviderObservation(", "await browser.readAuthenticatedMedia(")
    && text(context, IMAGE).includes("probeBudgetMs < 1 || probeBudgetMs > 3_600_000")
    && imageBody.includes('code !== "BROWSER_AUTHENTICATED_MEDIA_USER_TURN_ABSENT"')
    && imageBody.includes('code !== "BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT"'),
  "gpt/provider-observation-gate-first", IMAGE, "Authenticated image readback respects the approved budget and only retries the two frozen pending outcomes.", findings, finding);
};
const inspectPersistedCheckpointOrder = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const method = sourceFor(context, TOOLS)?.getClass("ProductionGptChildTools")?.getMethod("executeOne")?.getText() ?? "";
  const preparation = text(context, `${ROOT}/production-call-preparation.ts`);
  check(before(method, "recoverPersistedCheckpoint(", "acquireProductionBrowserCall(")
    && method.includes("if (recovered) return recovered")
    && preparation.includes('input.call.child !== "checkpoint_gpt_text_response"')
    && preparation.includes('input.call.child !== "checkpoint_gpt_generated_image"')
    && preparation.includes("readPersistedGptTextResponse(identity)")
    && preparation.includes("readPersistedGptImageEvidence(identity)")
    && preparation.includes("executeProductionGptAtomicCall("),
  "gpt/persisted-checkpoint-before-browser", TOOLS,
  "Exact text and image artifacts return before acquiring Browser or entering the unique atomic phase.", findings, finding);
};

export const inspectGeneratedImageRawBoundary = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const expected = ["assistantTurnId", "authorityDocumentHash", "authorityTargetHash", "canonicalConversationUrl", "mediaHash", "originalBytes",
    "originalMediaType", "originalSha256", "originalSizeBytes", "semanticMediaId", "turnMarker"].sort();
  const types = sourceFor(context, `${ROOT}/child-types.ts`)?.getInterface("GptChildOutputMap")?.getProperty("checkpoint_gpt_generated_image")
    ?.getTypeNode()?.getDescendantsOfKind(SyntaxKind.PropertySignature).map(property => property.getName()).sort() ?? [];
  const image = sourceFor(context, IMAGE), handler = image?.getVariableDeclaration("checkpointGptGeneratedImageHandler")?.getInitializer();
  const success = calls(handler, "success")[0]?.getArguments()[0], value = Node.isObjectLiteralExpression(success) ? success.getProperty("value") : undefined;
  const returned = objectKeys(Node.isPropertyAssignment(value) ? value.getInitializer() : undefined);
  const settlement = sourceFor(context, `${ROOT}/production-child-result.ts`)?.getVariableDeclaration("recordSettledProviderResult")?.getInitializer();
  const fields = settlement?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).filter(property => property.getExpression().getText() === "row").map(property => property.getName()) ?? [];
  const body = handler?.getText() ?? "";
  check(JSON.stringify(types) === JSON.stringify(expected) && JSON.stringify(returned) === JSON.stringify(expected)
    && !image?.getImportDeclarations().some(imported => imported.getModuleSpecifierValue() === "sharp") && !/\.(?:resize|extract|extend|webp)\(/u.test(body)
    && fields.includes("originalSha256") && !fields.includes("sha256") && body.includes('Buffer.from(media.bytesBase64, "base64")')
    && body.includes("hash(original) !== media.sha256 || original.byteLength !== media.sizeBytes") && body.includes("originalBytes: new Uint8Array(original)"),
  "gpt/generated-image-raw-only", IMAGE, "Image output verifies and preserves the exact original bytes, size and SHA without re-encoding.", findings, finding);
};
const inspectRawImageArtifact = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const generated = sourceFor(context, ARTIFACTS)?.getVariableDeclaration("generatedImageArtifacts")?.getInitializer();
  const returnedArtifacts = generated?.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression();
  const elements = Node.isArrayLiteralExpression(returnedArtifacts) ? returnedArtifacts.getElements() : [];
  const artifact = elements.length === 1 && Node.isObjectLiteralExpression(elements[0]) ? elements[0] : undefined;
  const initializer = (name: string) => { const property = artifact?.getProperty(name); return Node.isPropertyAssignment(property) ? property.getInitializer()?.getText() : ""; };
  check(JSON.stringify(objectKeys(artifact)) === JSON.stringify(["artifactType", "content", "mimeType", "suffix"].sort())
    && initializer("suffix") === '"original"' && initializer("artifactType") === '"ai_raw_output"'
    && initializer("mimeType") === "row.originalMediaType as string" && initializer("content") === "new Uint8Array(original)",
  "gpt/generated-image-one-raw-artifact", ARTIFACTS, "Image delivery persists exactly one unchanged original-media artifact.", findings, finding);
};

const inspectSubmissionLocatorContract = (context: InspectorContext, findings: InspectorFinding[],
  finding: FindingFactory, submitPath: string): void => {
  const submit = text(context, submitPath);
  const submitProof = text(context, "src/lib/browser/exact-target/browser-submit-recovery-payload.ts");
  check(["expectedPromptHash: approvedHash", "expectedAttachmentLabels: files.map(file => file.providerDisplayName)", "userTurnSelector: GPT_USER_TURN_SELECTOR",
    "latestGptUserTurn: true", "selector: GPT_EMPTY_COMPOSER_SELECTOR", "proof.promptHash !== approvedHash",
    "proof.userTurnId", 'status: "CONFIRMED", promptHash', "physicalInputCount !== 1", "proof.exactCallIdentityHash !== exactCallIdentityHash"].every(token => submit.includes(token))
    && !submit.includes("canonicalConversation") && submitProof.includes('schemaVersion: PROOF_SCHEMA'),
  "gpt/current-provider-chain", submitPath, "Submit proves the exact message and immutable Browser receipt independently of URL readiness.", findings, finding);
  const locatorPath = `${ROOT}/children/get_submitted_gpt_conversation_url/handler.ts`, locator = text(context, locatorPath);
  check(["submittedConversationLocator", "readSubmittedConversationUrl({ ...input", "locator.providerEffectIdentityHash !== input.providerEffectIdentityHash",
    'mutationOutcome: "no"', "locator.locatorHash"].every(token => locator.includes(token))
    && !/kind: "click"|submitExactGptTurnOnceHandler|selectExactGptConversation/u.test(locator),
  "gpt/current-provider-chain", locatorPath, "The independent URL Child consumes the original effect locator with no new Provider input.", findings, finding);
};

export const inspectProviderWaitContract = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  check(textResponseTwoGateSettlementIsFrozen(text(context, TEXT)),
    "gpt/provider-observation-gate-first", TEXT, "Text readback must execute the sole frozen observation gate and exact response settlement.", findings, finding);
  inspectImageObservationOrder(context, findings, finding);
  inspectPersistedCheckpointOrder(context, findings, finding);
  inspectGeneratedImageRawBoundary(context, findings, finding);
  inspectRawImageArtifact(context, findings, finding);
  const submitPath = `${ROOT}/children/submit_exact_gpt_turn_once/handler.ts`;
  inspectSubmissionLocatorContract(context, findings, finding, submitPath);
  const outgoing = text(context, "src/lib/browser/chrome-extension/dom-coherent-candidate.ts");
  check(outgoing.includes("expectedLabels.includes(providerLabel(label))")
    && !/priorTurns\.length > 1|querySelectorAll\(outgoing\.userTurnSelector\)|baselineOrdinal \+ 2/u.test(outgoing),
  "gpt/current-provider-chain", submitPath, "The single outgoing click retains exact approved labels and no retired turn shortcut.", findings, finding);
  const tools = text(context, TOOLS), result = text(context, `${ROOT}/production-child-result.ts`), ports = text(context, `${ROOT}/production-ports.ts`);
  check(tools.includes("readProviderEffectStepCallFact({") && tools.includes("confirmedSubmitIdentity(input, call, existing)")
    && result.includes("inputHash: existing.inputHash") && result.includes("browserExactCallIdentityHash({") && result.includes("exactCallIdentityHash !== existing.exactCallIdentityHash")
    && ports.includes("readProviderEffectStepCallFact(input:") && ports.includes("BrowserProviderEffectStepCallFact | null")
    && ![tools, ports].some(value => value.includes("readProviderEffectStepCallIdentities")),
  "gpt/historical-provider-effect-authority", TOOLS, "Historical readback retains the original full Browser identity, including its original input hash.", findings, finding);
  const artifacts = text(context, ARTIFACTS);
  check(["readPersistedGptTextResponse", "FORENSICS_ARTIFACT_NOT_FOUND", "GPT_TEXT_TASK_ARTIFACT_INVALID", "observedResponseArtifact(row)"].every(token => artifacts.includes(token)),
    "gpt/current-provider-chain", ARTIFACTS, "Artifact recovery rejects missing or invalid exact response bytes.", findings, finding);
  for (const path of [TEXT, IMAGE, `${ROOT}/web/gpt-dom-observation.ts`]) check(!/adjacentGptAssistantTurnId|downloadAuthenticatedMedia|visible-download|requireConfirmedBrowserFact\(intent, browser\)|expectedPromptHash|precedingPromptHash|responseHashInput/u.test(text(context, path)),
    "gpt/response-prompt-rehash-absent", path, "Response readback uses turn identity without a second prompt authority.", findings, finding);
  for (const path of [TEXT, IMAGE]) check(!/browser\.wait\(|selectExactGptConversation|let delay = 250|Math\.min\(5_000|\* 1\.5/u.test(text(context, path)),
    "gpt/no-child-poll-clock", path, "Checkpoint Children cannot own a polling clock or navigation route.", findings, finding);
  const semantic = text(context, "src/lib/browser/chrome-extension/dom-semantic-text.ts"), exactPath = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts", exact = text(context, exactPath);
  check(["browserCanonicalSemanticText", "insidePre", 'name === "CODE"'].every(token => semantic.includes(token))
    && exact.includes("BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE") && exact.includes("browserCanonicalSemanticText"),
  "gpt/current-provider-chain", exactPath, "The exact assistant channel consumes the sole canonical semantic-text reader.", findings, finding);
  for (const path of [TEXT, IMAGE, submitPath, `${ROOT}/web/gpt-dom-observation.ts`]) check(!/reconcile_gpt_draft|reconcile_gpt_turn_submission|wait_for_stable_gpt_text|wait_for_stable_gpt_image|fork_exact_gpt_conversation_at_checkpoint/u.test(text(context, path)),
    "gpt/retired-provider-step-absent", path, "Retired Provider Steps remain unreachable.", findings, finding);
};
export const inspectGptCrossTaskStateAbsence = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  for (const path of [TOOLS, `${ROOT}/production-execution-session.ts`, `${ROOT}/production-execution-source-reuse.ts`, `${ROOT}/production-ports.ts`, `${ROOT}/product-api.ts`])
    check(!/acquireContinuation|recordContinuation|GptContinuationStore|gpt_continuations|consultationIdentityHash|predecessorSourceTaskRef|readConfirmedProviderLocator/u.test(text(context, path)),
      "gpt/no-cross-task-provider-state", path, "GPT cannot duplicate Product continuation authority or storage.", findings, finding);
};
