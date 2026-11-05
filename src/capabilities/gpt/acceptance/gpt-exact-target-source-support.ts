import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";
import { textResponseTwoGateSettlementIsFrozen } from "../../../../scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.js";
import { inspectGptAttachmentContract } from "../../../../scripts/audit/domains/gpt/gpt-attachment-contract-inspection.js";
import type { InspectorContext, InspectorFinding } from "../../../../scripts/audit/shared/inspector-contracts.js";

export const providerAttachmentName = (displayName: string, artifactRef: string): string => {
  const dot = displayName.lastIndexOf("."), stem = dot > 0 ? displayName.slice(0, dot) : displayName;
  const extension = dot > 0 ? displayName.slice(dot) : "";
  const token = createHash("sha256").update(`job:gpt-exact-target\u0000${artifactRef}`).digest("hex").slice(0, 12);
  return `${stem}-${token}${extension}`;
};
export const assertGptExactTargetSourceShape = (baseUrl: string): void => {
  const read = (path: string) => readFileSync(new URL(path, baseUrl), "utf8");
  for (const path of ["../gpt-turn-executor.ts", "../../../lib/local-runtime/production/gpt-turn-state.ts",
    "../../../lib/local-runtime/production/production-gpt-executor.ts", "../../../lib/local-runtime/production/production-gpt-turn-flow.ts"])
    assert.equal(existsSync(new URL(path, baseUrl)), false, `${path} must be physically absent`);
  for (const path of ["../contract.ts", "../ability-group.ts", "../production-child-tools.ts", "../production-execution-session.ts",
    "../production-execution-source-reuse.ts", "../production-browser-lifecycle.ts", "../../../mediator/product-plugin-contract.ts"])
    assert.doesNotMatch(read(path), /GptTurnExecutor|GPT_TURN_FLOW|runTurn|stepIndex|flowVersion|resumePoint|reconcileOnly/u);
  const rateLimit = read("../../../lib/browser/chrome-extension/gpt-rate-limit-dialog.ts");
  assert.match(rateLimit, /executeClickIntent\([\s\S]*dispatchNotAfter[\s\S]*\}, false\);/u);
  assert.match(rateLimit, /innerText/u);
  assert.doesNotMatch(rateLimit, /textContent|unknown_present|known-gpt-rate-limit-dialog\.v1/u);
  for (const token of ["absent", "exact_present", "mismatch", "dialogRawCount", "dialogEligibleCount", "dialogActionableCount",
    "acknowledgementButtonRawCount", "acknowledgementButtonEligibleCount", "acknowledgementButtonActionableCount"]) assert.ok(rateLimit.includes(token));
  assert.match(read("../production-child-result.ts"), /persistGptChildOutcome[\s\S]*persistGptEvidenceArtifacts/u);
  const project = new Project({ useInMemoryFileSystem: true });
  const tools = project.createSourceFile("tools.ts", read("../production-child-tools.ts"));
  const support = project.createSourceFile("support.ts", read("../production-child-support.ts"));
  const owner = tools.getClassOrThrow("ProductionGptChildTools");
  const execute = owner.getMethodOrThrow("executeOne"), settlement = owner.getMethodOrThrow("settleChildOutcome");
  const calls = (method: typeof execute, name: string) => method.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText() === name);
  const handoff = calls(execute, "this.settleChildOutcome");
  assert.equal(handoff.length, 1, "one execution has one settlement consumer");
  assert.equal(execute.getStatements().at(-1)?.getText(),
    "return this.settleChildOutcome({ execution, browsers, call, options, intent, span, browserCall, result });",
    "settlement receives the original call/result/span once, outside normalization");
  assert.equal(handoff[0]!.getFirstAncestorByKind(SyntaxKind.CatchClause), undefined);
  assert.equal(calls(execute, "this.closeKnownRateLimitAndReadGate").length, 0);
  assert.equal(calls(execute, "terminalizeGptChildResult").length, 0);
  const closureCalls = calls(settlement, "this.closeKnownRateLimitAndReadGate");
  assert.equal(closureCalls.length, 1, "one Child result has one incident closure boundary");
  assert.equal(closureCalls[0]!.getFirstAncestorByKind(SyntaxKind.CatchClause), undefined,
    "a closure failure cannot re-enter the normalization catch");
  const persistence = calls(settlement, "persistGptChildOutcome"), terminal = calls(settlement, "terminalizeGptChildResult");
  assert.equal(persistence.length, 1); assert.equal(terminal.length, 1);
  assert.ok(closureCalls[0]!.getEnd() < persistence[0]!.getStart() && persistence[0]!.getEnd() < terminal[0]!.getStart(),
    "incident closure precedes evidence persistence and the one terminalization");
  const catchBody = execute.getDescendantsOfKind(SyntaxKind.CatchClause)[0]!.getText();
  assert.match(catchBody, /handleGptChildExecutionError/u);
  assert.doesNotMatch(catchBody, /terminalizeGptChildResult|closeKnownRateLimitAndReadGate|settleChildOutcome/u);
  const normalize = support.getVariableDeclarationOrThrow("handleGptChildExecutionError").getInitializerOrThrow().getText();
  assert.match(normalize, /BROWSER_GPT_DIALOG_UNRECOGNIZED/u);
  assert.match(normalize, /BROWSER_KNOWN_GPT_RATE_LIMIT/u);
  assert.match(normalize, /failedGptChildExecutionResult/u);
  assert.doesNotMatch(normalize, /closeKnownRateLimit|terminalizeGptChildResult/u);
  assert.match(read("../../../lib/browser/chrome-extension/dom-pointer-intent-runtime.ts"),
    /preClickExactOutgoingTurn !== undefined\)[\s\S]*return prepareExactOutgoingClick/u);
  assertAttachmentInspectorCounterexamples(baseUrl);
};
const assertFrozenResponseCounterexamples = (source: string): void => {
  assert.equal(textResponseTwoGateSettlementIsFrozen(source), true);
  const documented = "/** Harmless documentation. */\n" + source;
  assert.notEqual(documented, source);
  assert.equal(textResponseTwoGateSettlementIsFrozen(documented), true);
  const done = 'if (assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {';
  assert.ok(source.includes(done));
  assert.equal(textResponseTwoGateSettlementIsFrozen(source.replace(done, done.replace(") {", ") {} {"))), false,
    "DONE must remain inside its approved two-gate condition.");
  const extra = 'const assertExtraGate = (assistant: unknown): void => { if (assistant) throw new Error("UNAPPROVED_THIRD_GATE"); };\n';
  const root = source.replace("exactResponseObserved = assistant !== null;", "exactResponseObserved = assistant !== null; assertExtraGate(assistant);");
  assert.notEqual(root, source); assert.equal(textResponseTwoGateSettlementIsFrozen(extra + root), false);
  const file = new Project({ useInMemoryFileSystem: true }).createSourceFile("response.ts", source);
  const settlement = file.getVariableDeclarationOrThrow("settledTextResponse").getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction).getBody().getText();
  const nested = source.replace(settlement, "{ assertExtraGate(assistant); return " + settlement + "; }");
  assert.notEqual(nested, source); assert.equal(textResponseTwoGateSettlementIsFrozen(extra + nested), false);
  for (const [original, replacement] of [
    ["rawDomHtml: assistant.rawDomHtml,", 'rawDomHtml: assistant.semanticText.length > 100 && assistant.rawDomHtml || "",'],
    ["semanticTextHash: assistant.semanticTextHash", 'semanticTextHash: "invented"'],
    ["browser, userTurnId, turnMarker, conversationUrl", 'browser, userTurnId, "foreign-marker", conversationUrl'],
    ["negativeWindow.current = null;", "negativeWindow.current = negativeWindow.current;"],
    ["current.userTurnId === negative.userTurnId", "current.userTurnId !== negative.userTurnId"],
    ["observation.observationCount >= 2", "observation.observationCount >= 1"],
    ["Date.parse(observation.observedAt) > Date.parse(observation.firstObservedAt)", 'Date.parse(observation.observedAt) > Date.parse(observation.firstObservedAt) && observation.userTurnId === "fixed-id"'],
    ["return settledTextResponse(assistant);", "return\n settledTextResponse(assistant);"],
    ['gptExecutionFailure("GPT_TEXT_RESPONSE_EMPTY_ENDED",', 'gptExecutionFailure("GPT_RESPONSE_STOPPED_EMPTY",'],
    ['gptExecutionFailure("GPT_TEXT_RESPONSE_EMPTY_ENDED",', 'gptExecutionFailure("GPT_TEXT_RESPONSE_EMPTY_ENDED ",'],
    ["context.stoppedEmptyRetryAuthorized === true", "context.stoppedEmptyRetryAuthorized !== true"],
    ["documentRefHash: assistant.documentRefHash,", "documentRefHash: assistant.documentRefHash, rawDomHash: assistant.rawDomHash,"],
    ["const gate = context.waitForProviderObservation;", "const gate = context.otherGate;"],
    ["if (exactResponseObserved) continue;", "if (exactResponseObserved) break;"],
    ['throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");', 'void executionFailure("failed", "GPT_RESPONSE_TIMEOUT");'],
    ['throw error;', 'void error;'],
    ["export const checkpointGptTextResponseHandler", "export let checkpointGptTextResponseHandler"],
  ]) {
    assert.ok(source.includes(original!));
    const changed = source.replace(original!, replacement!);
    assert.notEqual(changed, source);
    assert.equal(textResponseTwoGateSettlementIsFrozen(changed), false, original);
  }
};
const assertAttachmentInspectorCounterexamples = (baseUrl: string): void => {
  const root = fileURLToPath(new URL("../../../../", baseUrl)), project = new Project({ useInMemoryFileSystem: true });
  const gpt = "src/capabilities/gpt";
  const files = [
    "src/capabilities/gpt/children/prepare_clean_gpt_chat/selectors.ts",
    "src/capabilities/gpt/children/submit_exact_gpt_turn_once/selectors.ts",
    "src/capabilities/gpt/schema.ts", "src/capabilities/gpt/contract.ts", "src/capabilities/gpt/product-api.ts",
    "src/capabilities/gpt/children/attach_approved_gpt_files_once/handler.ts", "src/capabilities/gpt/children/attach_approved_gpt_files_once/selectors.ts",
    "src/capabilities/gpt/children/attach_approved_gpt_files_once/attachment-observation.ts", "src/capabilities/gpt/children/attach_approved_gpt_files_once/control-observation.ts",
    "src/capabilities/gpt/children/open_gpt_attachment_control/handler.ts", "src/capabilities/gpt/children/open_gpt_attachment_control/observation.ts",
    "src/capabilities/gpt/children/open_gpt_attachment_control/selectors.ts",
    "src/capabilities/gpt/children/reconcile_gpt_attachment_set/handler.ts", "src/capabilities/gpt/children/reconcile_gpt_attachment_set/selectors.ts",
    "src/capabilities/gpt/children/reconcile_gpt_attachment_set/observation.ts",
  ];
  files.push("src/lib/browser/chrome-extension/extension-file-input-runtime.ts",
    "src/lib/browser/exact-target/browser-target-lease.ts");
  for (const path of files) project.createSourceFile(resolve(root, path), readFileSync(resolve(root, path), "utf8"));
  const lawId = "LAW-GPT-002-V35", context: InspectorContext = { project, sealedRoot: root, selectedLawId: lawId,
    targetPaths: files, targetSet: { queryRef: "gpt-attachment-helper-counterexamples", count: files.length },
    lawRequirements: [], generatedPlan: [], planEntry: { capabilityDomain: "gpt", executionGroup: "domain", lawIds: [lawId],
      manifestPath: "scripts/audit/domains/gpt/manifest.json", ownerInspectorPath: "scripts/audit/domains/gpt/inspector.ts" } };
  const inspect = (): InspectorFinding[] => {
    const findings: InspectorFinding[] = [];
    inspectGptAttachmentContract(context, findings, (checkId, filePath, message) =>
      ({ checkId, filePath, message, lawId, clauseId: lawId, evidenceMode: "static.ast", severity: "fatal" }));
    return findings;
  };
  assert.deepEqual(inspect(), []);
  for (const path of files.filter(path => path.endsWith("/selectors.ts") && !path.includes("open_gpt_attachment_control"))
    .concat("src/lib/browser/chrome-extension/extension-file-input-runtime.ts")) {
    const source = project.getSourceFileOrThrow(resolve(root, path)), before = source.getFullText();
    for (const obsolete of ["button.composer-attachment-surface[aria-label]", ".composer-attachment-surface"]) {
      const mutant = before.replace(":is(button, div[role='button']).composer-attachment-surface[aria-label]", obsolete);
      assert.notEqual(mutant, before, path);
      try {
        source.replaceWithText(mutant);
        assert.ok(inspect().some(finding => finding.checkId === "gpt/chrome-proven-attachment-dom" && finding.filePath === path), path);
      } finally { source.replaceWithText(before); }
    }
  }
  assert.deepEqual(inspect(), []);
  const source = project.getSourceFileOrThrow(resolve(root, gpt + "/children/reconcile_gpt_attachment_set/observation.ts"));
  const before = source.getFullText(), original = "if (state.composerRawCount > 1";
  assert.ok(before.includes(original));
  try {
    source.replaceWithText(before.replace(original, "if (state.itemRawCount === 0 || state.composerRawCount > 1"));
    assert.ok(inspect().some(finding => finding.checkId === "gpt/attachment-readiness-terminal"), "No cards during the waiting period cannot trigger immediate terminal failure.");
  } finally { source.replaceWithText(before); }
  assert.deepEqual(inspect(), []);
  const timeoutBody = source.getVariableDeclarationOrThrow("attachmentSettlementTimeout").getInitializerOrThrow().getText();
  const swappedTimeout = timeoutBody.replace("GPT_ATTACHMENT_SET_MISMATCH", "SWAP_ATTACHMENT_TERMINAL")
    .replace("GPT_ATTACHMENT_UPLOAD_TIMEOUT", "GPT_ATTACHMENT_SET_MISMATCH")
    .replace("SWAP_ATTACHMENT_TERMINAL", "GPT_ATTACHMENT_UPLOAD_TIMEOUT");
  try {
    source.replaceWithText(before.replace(timeoutBody, swappedTimeout));
    assert.ok(inspect().some(finding => finding.checkId === "gpt/attachment-readiness-terminal"), "Each deadline terminal keeps its own actual arguments.");
  } finally { source.replaceWithText(before); }
  assert.deepEqual(inspect(), []);
  assertFrozenResponseCounterexamples(readFileSync(resolve(root, gpt + "/children/checkpoint_gpt_text_response/handler.ts"), "utf8"));
};
