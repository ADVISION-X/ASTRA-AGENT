import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { sourceFor, type FindingFactory } from "./gpt-inspection-support.js";

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

const inspectGlobalObservationLane = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const lane = sourceFor(context, LANE), owner = lane?.getClass("BrowserLaneCoordinator"), laneText = lane?.getFullText() ?? "";
  const park = owner?.getMethod("withLifecycle"), parkText = park?.getText() ?? "", samples = calls(lane, "Math.random");
  const eligible = ["nextWaiter", "scheduleWake"].every(name => {
    const body = owner?.getMethod(name)?.getText() ?? "";
    return body.includes("Math.max(waiter.eligibleAt, this.observationNotBefore)") && body.includes('waiter.requestKind === "provider-observation"');
  });
  check(laneText.includes("private readonly queue: LaneWaiter[] = []") && laneText.includes("PROVIDER_OBSERVATION_MIN_INTERVAL_MS = 70_000")
    && laneText.includes("PROVIDER_OBSERVATION_RANDOM_SPAN_MS = 20_001") && samples.length === 1
    && samples[0]?.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) === park
    && /if \(kind === "provider-observation"\) this\.observationNotBefore = Date\.now\(\) \+ PROVIDER_OBSERVATION_MIN_INTERVAL_MS\s*\+ Math\.floor\(Math\.random\(\) \* PROVIDER_OBSERVATION_RANDOM_SPAN_MS\)/u.test(parkText)
    && parkText.includes("finally") && eligible && owner?.getProperties().filter(property => /Timer$/u.test(property.getName())).length === 1,
  "gpt/no-browser-poll-scheduler", LANE, "One Browser FIFO and wake timer own the global interval sampled once after a provider observation parks.", findings, finding);
  check(parkText.includes("new Proxy(lease") && !laneText.includes("...lease"), "gpt/live-browser-document", LANE, "The wrapper must retain the live Document getter.", findings, finding);
  const lifecycle = sourceFor(context, LIFECYCLE), lifecycleText = lifecycle?.getFullText() ?? "";
  check(!existsSync(resolve(context.sealedRoot, `${ROOT}/provider-wait-cross-conversation-cadence.ts`))
    && !/provider-probe|nextProviderProbeEligibleAt|startProviderProbeCooldown|waiter\.purpose/u.test(laneText)
    && !/Math\.random|yieldForProviderProbe|yieldForProviderWait|waitForDelay|yieldAndReacquire|productionGptCrossConversationPollCadence|"provider-probe"|startProviderProbeCooldown/u.test(lifecycleText),
  "gpt/no-second-wait-scheduler", LIFECYCLE, "GPT cannot own a second scheduler or random interval.", findings, finding);
};
export const inspectGptProviderProbeOwnerContract = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  inspectGlobalObservationLane(context, findings, finding);
  const lifecycleOwner = sourceFor(context, LIFECYCLE)?.getClass("ProductionGptBrowserLifecycle");
  const lifecycleText = text(context, LIFECYCLE);
  const wait = lifecycleOwner?.getMethod("waitForProviderObservation"), waitText = wait?.getText() ?? "", settlement = lifecycleOwner?.getMethod("parkActive");
  check(calls(wait, "active.facade.park").length === 1 && calls(settlement, "current.call.browser.park").length === 1
    && ["active.browser.pendingMutationCount() > 0", "const eligibleAt = Date.now() + PROVIDER_OBSERVATION_MIN_INTERVAL_MS",
      'productStepId, callId, observationDeadlineAt, "confirmed-readback", eligibleAt',
      "canonicalConversationUrl: active.confirmedProviderEffect!.canonicalConversationUrl", 'mode: "product-call-settlement"'].every(token => waitText.includes(token))
    && before(waitText, 'if (eligibleAt > observationDeadlineAt) return "deadline"', "await active.facade.park(")
    && before(waitText, "assertConfirmedProviderReadback(active)", "await active.facade.park(")
    && before(waitText, "await active.facade.park(", "await this.acquireBrowserLease(")
    && before(waitText, "await this.acquireBrowserLease(", 'kind: "selectExactGptConversation"')
    && settlement?.getText().includes('mode: "product-call-settlement"') === true
    && lifecycleOwner?.getMethod("settle")?.getText().includes("this.parkActive(") === true,
  "gpt/provider-observation-park-readback", LIFECYCLE, "Pending observations verify the original effect, park once and reacquire the same conversation after the Browser gate.", findings, finding);
  check(lifecycleText.includes("active.browser.readAtomicStepOutcome(confirmed.submitIdentity)")
    && lifecycleText.includes('recoverySelectionRequired: targetMode === "confirmed-readback"') && lifecycleText.includes('"bound-observation"')
    && lifecycleText.includes("parentAttemptId: this.execution.providerContinuationParent!.acceptedAttemptId"),
  "gpt/historical-provider-effect-authority", LIFECYCLE, "Readback remains bound to the original submit and accepted parent attempt.", findings, finding);
  const evidencePath = "src/lib/browser/exact-target/browser-mutation-evidence.ts", evidence = text(context, evidencePath);
  check(["parentAttemptId: string", "where job_id=? and attempt_id=? and product_step_id=?", "product_step_id=? and call_id='turn-submit'",
    "child_capability_id='submit_exact_gpt_turn_once'", "rows.length !== 1", ").all(parentJobId, parentAttemptId, parentProductStepId)"].every(token => evidence.includes(token)),
  "gpt/historical-provider-effect-authority", evidencePath, "Parent lookup requires the unique original job/attempt/step submit.", findings, finding);
};

const inspectObservationOrder = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const textSource = sourceFor(context, TEXT);
  const textLoop = textSource?.getDescendantsOfKind(SyntaxKind.WhileStatement).find(loop => calls(loop, "readExactAssistantTurn").length > 0);
  const body = textLoop?.getText() ?? "", gate = textLoop?.getDescendantsOfKind(SyntaxKind.IfStatement)
    .find(statement => statement.getExpression().getText().includes("await waitForProviderObservation("));
  check(!!gate && gate.getExpression().getText().endsWith('=== "deadline"') && gate.getThenStatement().getDescendantsOfKind(SyntaxKind.BreakStatement).length === 1
    && before(body, "await waitForProviderObservation(", "await readExactAssistantTurn(")
    && textSource?.getVariableDeclaration("requireObservationGate")?.getInitializer()?.getText().includes("GPT_PROVIDER_OBSERVATION_GATE_REQUIRED") === true,
  "gpt/provider-observation-gate-first", TEXT, "The exact deadline result stops Browser readback at the original gate.", findings, finding);
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
  check(before(method, "recoverPersistedTextCheckpoint(", "runProductionAtomicPhase(") && method.includes("if (recovered) return recovered")
    && preparation.includes("readPersistedGptTextResponse({") && preparation.includes("executeProductionGptAtomicCall("),
  "gpt/persisted-checkpoint-before-browser", TOOLS, "Same-call persisted response recovery returns before the actual unique atomic phase.", findings, finding);
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

export const inspectProviderWaitContract = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  inspectObservationOrder(context, findings, finding);
  inspectImageObservationOrder(context, findings, finding);
  inspectPersistedCheckpointOrder(context, findings, finding);
  inspectGeneratedImageRawBoundary(context, findings, finding);
  inspectRawImageArtifact(context, findings, finding);
  const submitPath = `${ROOT}/children/submit_exact_gpt_turn_once/handler.ts`, submit = text(context, submitPath);
  check(["expectedPromptHash: promptHash", "expectedAttachmentLabels: files.map(file => file.providerDisplayName)", "userTurnSelector: GPT_USER_TURN_SELECTOR",
    "latestGptUserTurn: true", "selector: GPT_EMPTY_COMPOSER_SELECTOR", "match.exactGptUserPromptHash !== promptHash", "canonicalConversationOrNull(packet.currentUrl)",
    "UUID.test(match.turnKey)", 'status: "CONFIRMED", promptHash', "physicalInputCount !== 1"].every(token => submit.includes(token)),
  "gpt/current-provider-chain", submitPath, "Submit uses the two approved preconditions and exact latest turn/empty composer readback.", findings, finding);
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
