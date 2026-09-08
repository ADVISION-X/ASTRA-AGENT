#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createChromeSceneCollector } from "./chrome-scene-collector.mjs";
import { candidateEntries } from "./assemble-live-capture.mjs";
import { derivePageInputBindingProof } from "./page-input-binding.mjs";
import { productRunFailures } from "./report-tool.mjs";

const ASSEMBLER = resolve(new URL("./assemble-live-capture.mjs", import.meta.url).pathname);
const COLLECTOR = resolve(new URL("./chrome-scene-collector.mjs", import.meta.url).pathname);
const hash = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
const promptHash = hash("approved prompt");
const emptyAttachmentSetHash = hash(JSON.stringify([]));
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const jobId = "aiprod_pipeline_acceptance";
const attemptId = "11111111-1111-4111-8111-111111111111";
const runId = `${jobId}:${attemptId}`;
const binding = { runId, captureEpoch: hash("capture-epoch"), qaTabIdentityHash: hash("tab") };

function sceneSignature(scene) {
  return hash(JSON.stringify({
    url: scene.url, activeTabIdentityHash: scene.activeTabIdentityHash,
    documentIdentityHash: scene.documentIdentityHash, observationRevisionHash: scene.observationRevisionHash,
    nodeCount: scene.nodeCount, nodes: scene.nodes, pageFacts: scene.pageFacts,
    binding: scene.binding, decisionReceipt: scene.decisionReceipt, transitionReceipt: scene.transitionReceipt,
  }));
}

const node = (attributes, marker = false, ownerTurnTestId = null) => ({
  tag: "div", attributes, rect: { x: 1, y: 1, width: 20, height: 20 },
  style: { display: "block", visibility: "visible", opacity: "1" }, connected: true,
  sanitizedDomTree: { tag: "div", attributes, text: { kind: "HASH_ONLY", sha256: hash(marker ? "product-marker" : ""), length: marker ? 14 : 0 },
    children: [{ tag: "span", attributes: { role: "presentation" },
      text: { kind: "HASH_ONLY", sha256: hash("nested"), length: 6 }, children: [] }] },
  sanitizedOuterHtml: `<div><span role="presentation"><!--text:HASH_ONLY:${hash("nested")}:6--></span></div>`,
  textProjection: { kind: "HASH_ONLY", sha256: hash(marker ? "product-marker" : ""), length: marker ? 14 : 0 },
  subtreeTextProjection: { kind: "HASH_ONLY", sha256: hash(marker ? "product-marker" : ""), length: marker ? 14 : 0 },
  machineFacts: { productTurnMarkerObserved: marker, ownerTurnTestId }, ancestors: [{ tag: "main" }], siblings: [],
});

function scene(sceneId, nodes, receipt = {}, pageFactOverrides = {}) {
  const value = {
    sceneId, capturedAt: `2026-09-08T00:00:${String(sceneId.length).padStart(2, "0")}.000Z`,
    url: `https://chatgpt.com/c/${hash("conversation")}`,
    activeTabIdentityHash: binding.qaTabIdentityHash, documentIdentityHash: hash("document"),
    observationRevisionHash: "", nodeCount: nodes.length, nodes,
    pageFacts: { currentRouteKind: "CONVERSATION", productUserTurnCount: nodes.some((entry) => entry.machineFacts.productTurnMarkerObserved) ? 1 : 0,
      currentConversationUrlHash: hash(`https://chatgpt.com/c/${hash("conversation")}`),
      exactComposerHash: nodes.some((entry) => entry.attributes.id === "prompt-textarea") ? promptHash : null,
      exactUserPromptHashes: nodes.some((entry) => entry.attributes["data-message-author-role"] === "user") ? [promptHash] : [],
      assistantSemanticTextHashes: [], attachmentLabelHashes: [], visibleModelTextHashes: [],
      reasoningScaleFacts: [], turnMarkerHashes: [], assistantTurnIdHashes: [], userTurnBindings: [],
      conversationTurnBindings: [], ...pageFactOverrides },
    binding, decisionReceipt: receipt.decision ?? null, transitionReceipt: receipt.transition ?? null,
  };
  value.observationRevisionHash = hash(JSON.stringify({
    documentIdentityHash: value.documentIdentityHash, url: value.url, nodes: value.nodes, pageFacts: value.pageFacts,
  }));
  return { ...value, stateSignature: sceneSignature(value) };
}

function source(trace) {
  const taskBinding = { jobId, requestHash: hash("request"), taskEnvelopeHash: hash("task"),
    businessContextHash: hash("context"), productId: "acceptance_product", actionId: "acceptance_action",
    parametersHash: hash("parameters"), resultContractId: "result", resultContractVersion: 1 };
  const materials = [];
  return {
    schemaVersion: "gpt-page-operation-production-source.v1",
    sourceKind: "PRODUCTION_RUNTIME_DURABLE_TASK", synthetic: false,
    jobId, attemptId, productId: "acceptance_product", actionId: "acceptance_action",
    pluginId: "acceptance-plugin", pluginVersion: 1,
    taskBinding, materials, materialSetHash: hash(JSON.stringify(stable(materials))),
    sourceSnapshotId: hash(JSON.stringify(stable({ taskBinding, materials }))),
    flowContractDigest: hash("flow"), traceDigest: hash(JSON.stringify(stable(trace))),
    flowStatus: "OBSERVED_COMPLETE_PATH", terminalBranch: "task-action-complete",
    terminalBranchProof: { kind: "DURABLE_COMPLETION_RECEIPT", receiptHash: hash("result"),
      resultPayloadHash: hash("payload"), resultObjectReceiptHash: hash("object-receipt"),
      resultPayloadOutboxHash: hash("outbox") },
    flowGaps: [], actualTrace: trace,
    reportInputs: { "production-prompt-contract": { kind: "PRODUCT_FLOW_SOURCE_BINDING", sha256: hash("prompt") } },
  };
}

function inputs(directory, traceCount = 1, includeProductCalls = true, duplicateExactCall = false) {
  const exactCalls = Array.from({ length: traceCount }, (_, index) =>
    hash(duplicateExactCall ? "same-logical-call" : `call-${index}`));
  const traceEntryIds = Array.from({ length: traceCount }, (_, index) => hash(`trace-entry-${index}`));
  const trace = exactCalls.map((exactCallIdentityHash, index) => ({
    traceEntryId: traceEntryIds[index],
    productStepId: `step-${index + 1}`, actionOrdinal: index + 1,
    childId: "submit_exact_gpt_turn_once", exactCallIdentityHash,
    resultStatus: "success", inputBinding: {
      schemaVersion: "gpt-page-input-binding.v1", source: "FORENSICS_SAFE_PROJECTION",
      inputHash: hash(`input-${index}`), roleHashes: {
        promptHash, responseHash: null, attachmentLabelHashes: [], attachmentSetHash: emptyAttachmentSetHash,
        modelDisplayNameHash: null, reasoningRequirement: null, conversationUrlHash: null,
        turnMarkerHash: null, assistantTurnIdHash: null,
      },
    }, browserReceipts: [],
  }));
  const inventory = {
    matrixBinding: { digest: hash("matrix") },
    denominator: { pageOperationChildIds: ["submit_exact_gpt_turn_once", "unused_page_child"] },
    children: [{
      childCapabilityId: "submit_exact_gpt_turn_once", contractVersion: 4, pageOperationRequired: true,
      contract: { profile: "PROVIDER_EFFECT_ONCE" },
      webImplementationReferences: [{ path: "src/capabilities/gpt/children/submit_exact_gpt_turn_once/handler.ts" }],
      collectionRequirements: { requiredInputRefs: ["production-prompt-contract"] },
      evidenceDemand: { digest: hash("demand"), childCandidateDigest: hash("candidate"),
        facts: [{ factId: "target:composer", expected: "composer" }],
        sourceBinding: { authority: { files: [], semanticDigest: hash("authority") }, consumers: { files: [] } } },
    }, {
      childCapabilityId: "unused_page_child", contractVersion: 1, pageOperationRequired: true,
      contract: { profile: "DOM_OBSERVATION" }, webImplementationReferences: [],
      collectionRequirements: { requiredInputRefs: [] },
      evidenceDemand: { digest: hash("unused-demand"), childCandidateDigest: hash("unused-candidate"),
        facts: [], sourceBinding: { authority: { files: [], semanticDigest: hash("unused-authority") }, consumers: { files: [] } } },
    }],
  };
  const matrix = { commonRequiredDerivedStates: ["candidate-missing"], chainInputSources: {}, children: [{
    childCapabilityId: "submit_exact_gpt_turn_once", requiredInputRefs: ["production-prompt-contract"],
    coreTargets: ["composer", "submit-control", "user-turn"],
    requiredLiveStates: ["pre-submit-ready", "post-submit-user-turn", "confirmed-submit-effect-readback"],
    liveStateTargets: {
      "pre-submit-ready": ["composer", "submit-control"],
      "post-submit-user-turn": ["user-turn"],
      "confirmed-submit-effect-readback": ["user-turn"],
    }, childSpecificDerivedStates: [], stateAssertions: {},
  }, {
    childCapabilityId: "unused_page_child", requiredInputRefs: [], coreTargets: ["page-root"],
    requiredLiveStates: ["unused-state"], liveStateTargets: { "unused-state": ["page-root"] },
    childSpecificDerivedStates: [], stateAssertions: {},
  }] };
  const composer = node({ id: "prompt-textarea", contenteditable: "true" });
  const send = node({ "data-testid": "send-button", type: "button" });
  const user = node({ "data-message-author-role": "user" }, true, "conversation-turn-1");
  const userBindingFacts = { userTurnBindings: [{ userTurnIdHash: hash("conversation-turn-1"),
    promptHash, turnMarkerHashes: [] }] };
  const pre = scene("pre-ready", [composer, send], { decision: {
    kind: "ACTION_REQUIRED", actionId: "action:submit", operation: "click",
  } });
  const scenes = [pre,
    scene("post-user", [user], { transition: {
      actionId: "action:submit", operation: "click", issuedAt: pre.capturedAt, completedAt: pre.capturedAt,
      outcome: "DISPATCH_RETURNED", preSceneId: pre.sceneId, preSceneSignature: pre.stateSignature,
    } }, userBindingFacts),
    scene("confirmed-user", [user], { decision: {
      kind: "ALREADY_SATISFIED", reason: "acceptance-only-input-detail",
    } }, userBindingFacts)];
  const states = { "pre-submit-ready": "pre-ready", "post-submit-user-turn": "post-user",
    "confirmed-submit-effect-readback": "confirmed-user" };
  const productStates = traceEntryIds.map((_, index) => {
    if (index === 0) return states;
    const suffix = `-call-${index}`;
    const idMap = Object.fromEntries(Object.values(states).map((id) => [id, `${id}${suffix}`]));
    const clones = scenes.slice(0, 3).map((source) => {
      const cloned = structuredClone(source);
      cloned.sceneId = idMap[source.sceneId];
      if (cloned.transitionReceipt?.preSceneId) cloned.transitionReceipt.preSceneId = idMap[cloned.transitionReceipt.preSceneId];
      cloned.stateSignature = sceneSignature(cloned);
      return cloned;
    });
    scenes.push(...clones);
    return Object.fromEntries(Object.entries(states).map(([stateId, sceneId]) => [stateId, idMap[sceneId]]));
  });
  const mapping = { authorizedInputs: {},
    productCalls: includeProductCalls ? Object.fromEntries(traceEntryIds.map((entry, index) =>
      [entry, { states: productStates[index] }])) : {} };
  const browser = { captureEpoch: binding.captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE", scope: ["acceptance_product/acceptance_action"], requestedAt: "2026-09-08T00:00:00.000Z" },
    browser: { family: "chrome", version: "acceptance", controlSkill: "chrome:control-chrome",
      dedicatedQaTab: true, qaTabCreatedByRun: true, livePageObserved: true,
      productionBrowserIdleEvidence: { observed: true, evidenceSceneId: "acceptance-only-input-detail" },
      qaTabIdentityHash: binding.qaTabIdentityHash },
    environment: { locale: "zh-CN", viewport: { width: 1200, height: 800 }, theme: "light", providerBuildMarker: hash("build") } };
  return { directory, inventory, matrix, scenes, mapping, productionSource: source(trace), browser };
}

async function runAssembler(data, expected = 0) {
  for (const [name, value] of Object.entries(data)) {
    if (name === "directory") continue;
    await writeFile(join(data.directory, `${name}.json`), `${JSON.stringify(value)}\n`);
  }
  const output = join(data.directory, "output.json");
  const result = spawnSync(process.execPath, [ASSEMBLER,
    "--inventory", join(data.directory, "inventory.json"), "--matrix", join(data.directory, "matrix.json"),
    "--scenes", join(data.directory, "scenes.json"), "--mapping", join(data.directory, "mapping.json"),
    "--production-source", join(data.directory, "productionSource.json"),
    "--browser-meta", join(data.directory, "browser.json"), "--output", output,
  ], { encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return { output, result };
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-v6-"));
  const collectorOutput = join(root, "collector-scenes.json");
  const collectorTab = {
    id: "collector-tab",
    url: async () => "https://chatgpt.com/c/private-conversation-id",
    playwright: { locator: () => ({ evaluateAll: async () => ({
      currentUrl: "https://chatgpt.com/c/private-conversation-id",
      documentTimeOrigin: 123,
      pageInputFacts: { exactComposerText: "", userPromptTexts: [], assistantSemanticTexts: [],
        attachmentLabels: [], modelTexts: [], reasoningScaleFacts: [], assistantTurnIds: [],
        userTurnBindings: [], turnBindings: [] },
      nodes: [{
        tag: "div", attributes: { "data-testid": "composer", "aria-label": "private aria" },
        domTree: { kind: "ELEMENT", tag: "div", attributes: { "data-testid": "composer" }, children: [
          { kind: "ELEMENT", tag: "span", attributes: { role: "presentation" },
            children: [{ kind: "TEXT", value: "private product text" }] },
        ] },
        rect: { x: 1, y: 2, width: 30, height: 40 },
        style: { display: "block", visibility: "visible", opacity: "1" }, connected: true,
        directText: "private product text", subtreeText: "private product text",
        machineFacts: {}, ancestors: [{ tag: "main" }], siblings: [], media: null,
      }],
    }) }) },
  };
  const collector = await createChromeSceneCollector({ tab: collectorTab, outputPath: collectorOutput,
    productMarker: "private product text", runId, captureEpoch: binding.captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE" }, qaTabIdentityHash: hash("collector-tab") });
  const collected = await collector.collect("collector-live");
  assert.match(collected.nodes[0].sanitizedOuterHtml, /<span role="presentation">/u);
  assert.equal(collected.nodes[0].sanitizedOuterHtml.includes("private product text"), false);
  assert.equal(collected.nodes[0].sanitizedDomTree.children[0].children[0].kind, "HASH_ONLY_TEXT");
  await assert.rejects(collector.collect("collector-invalid-decision", { decisionReceipt: {
    kind: "ALREADY_SATISFIED", debugNote: "must-not-pass",
  } }), /CHROME_SCENE_DECISION_RECEIPT_INVALID/u);
  const collectedPre = await collector.collect("collector-pre-action", { decisionReceipt: {
    kind: "ACTION_REQUIRED", actionId: "action:acceptance", operation: "click",
  } });
  await assert.rejects(collector.collect("collector-invalid-transition", { transitionReceipt: {
    actionId: "action:acceptance", operation: "click", issuedAt: collectedPre.capturedAt,
    completedAt: collectedPre.capturedAt, outcome: "DISPATCH_RETURNED",
    preSceneId: collectedPre.sceneId, preSceneSignature: collectedPre.stateSignature,
    debugNote: "must-not-pass",
  } }), /CHROME_SCENE_TRANSITION_RECEIPT_INVALID/u);

  const baseline = await runAssembler(inputs(root));
  const capture = JSON.parse(await readFile(baseline.output, "utf8"));
  assert.equal(capture.schemaVersion, "gpt-page-operation-capture.v6");
  assert.equal(capture.productionSource.synthetic, false);
  assert.deepEqual(capture.children.map((entry) => entry.childCapabilityId), ["submit_exact_gpt_turn_once"]);
  assert.equal(capture.productRun.calls.length, 1);
  assert.equal(capture.productRun.calls[0].captureComplete, true);
  assert.equal(capture.productRun.calls[0].inputBindingProof.complete, true);
  assert.ok(capture.productRun.calls[0].inputBindingProof.checks.every((entry) => entry.status === "MATCHED"));
  assert.match(capture.productRun.calls[0].domEvidence.specimens[0].core.sanitizedOuterHtml,
    /<span role="presentation">/u);
  assert.equal("candidateBinding" in capture, false);
  assert.deepEqual(capture.browser.productionBrowserIdleEvidence, { observed: true });
  assert.deepEqual(capture.sceneManifest.find((entry) => entry.sceneId === "confirmed-user").decisionReceipt,
    { kind: "ALREADY_SATISFIED" });

  const expectedSelectionRoles = { promptHash: hash("selected-prompt"), responseHash: hash("selected-response"),
    turnMarkerHash: hash("[GRASSEYE:222222222222222222222222]"),
    assistantTurnIdHash: hash("conversation-turn-4") };
  const multiTurnScene = { nodes: [
    node({ "data-message-author-role": "user" }, false, "conversation-turn-1"),
    node({ "data-message-author-role": "user" }, true, "conversation-turn-3"),
    node({ "data-message-author-role": "assistant" }, false, "conversation-turn-2"),
    node({ "data-message-author-role": "assistant" }, false, "conversation-turn-4"),
    node({ "aria-label": "更多操作" }, false, "conversation-turn-2"),
    node({ "aria-label": "更多操作" }, false, "conversation-turn-4"),
  ], pageFacts: {
    userTurnBindings: [{ userTurnIdHash: hash("conversation-turn-1"), promptHash: hash("other-prompt"),
      turnMarkerHashes: [hash("other-marker")] },
    { userTurnIdHash: hash("conversation-turn-3"), promptHash: expectedSelectionRoles.promptHash,
      turnMarkerHashes: [expectedSelectionRoles.turnMarkerHash] }],
    conversationTurnBindings: [{ assistantTurnIdHash: hash("conversation-turn-2"),
      precedingPromptHash: hash("other-prompt"), responseHash: hash("other-response"),
      turnMarkerHashes: [hash("other-marker")] },
    { assistantTurnIdHash: expectedSelectionRoles.assistantTurnIdHash,
      precedingPromptHash: expectedSelectionRoles.promptHash, responseHash: expectedSelectionRoles.responseHash,
      turnMarkerHashes: [expectedSelectionRoles.turnMarkerHash] }],
  } };
  const exactCandidateContext = { expectedPageInputRoles: expectedSelectionRoles };
  assert.equal(candidateEntries("user-turn", multiTurnScene, exactCandidateContext).length, 1);
  assert.equal(candidateEntries("user-turn", multiTurnScene, exactCandidateContext)[0]
    .node.machineFacts.ownerTurnTestId, "conversation-turn-3");
  assert.equal(candidateEntries("source-turn", multiTurnScene, exactCandidateContext).length, 1);
  assert.equal(candidateEntries("source-turn", multiTurnScene, exactCandidateContext)[0]
    .node.machineFacts.ownerTurnTestId, "conversation-turn-4");
  assert.equal(candidateEntries("source-turn-more-actions-control", multiTurnScene, exactCandidateContext).length, 1);
  assert.equal(candidateEntries("source-turn-more-actions-control", multiTurnScene, exactCandidateContext)[0]
    .node.machineFacts.ownerTurnTestId, "conversation-turn-4");

  const continuationRoles = ["promptHash", "responseHash", "conversationUrlHash", "turnMarkerHash", "assistantTurnIdHash"];
  const continuationExpected = { promptHash: hash("source-prompt"), responseHash: hash("source-response"),
    attachmentLabelHashes: null, attachmentSetHash: null, modelDisplayNameHash: null, reasoningRequirement: null,
    conversationUrlHash: hash("https://chatgpt.com/c/source"), turnMarkerHash: hash("[GRASSEYE:111111111111111111111111]"),
    assistantTurnIdHash: hash("conversation-turn-2") };
  const coherentTurnFacts = { exactComposerHash: null, exactUserPromptHashes: [continuationExpected.promptHash],
    assistantSemanticTextHashes: [continuationExpected.responseHash], attachmentLabelHashes: [], visibleModelTextHashes: [],
    reasoningScaleFacts: [], currentConversationUrlHash: continuationExpected.conversationUrlHash,
    turnMarkerHashes: [continuationExpected.turnMarkerHash], assistantTurnIdHashes: [continuationExpected.assistantTurnIdHash],
    conversationTurnBindings: [{ assistantTurnIdHash: continuationExpected.assistantTurnIdHash,
      precedingPromptHash: continuationExpected.promptHash, responseHash: continuationExpected.responseHash,
      turnMarkerHashes: [continuationExpected.turnMarkerHash] }] };
  for (const childId of ["open_gpt_checkpoint_actions_menu", "open_gpt_fork_destination_menu",
    "fork_exact_gpt_conversation_at_checkpoint"]) {
    const traceEntry = { childId, inputBinding: { schemaVersion: "gpt-page-input-binding.v1",
      source: "FORENSICS_SAFE_PROJECTION", inputHash: hash(`${childId}:input`), roleHashes: continuationExpected } };
    const specimen = { evidenceKind: "LIVE_PAGE", sourceSceneId: `${childId}:scene`, stateFacts: coherentTurnFacts };
    assert.equal(derivePageInputBindingProof(traceEntry, [specimen]).complete, true);
    for (const role of continuationRoles) {
      const missing = structuredClone(traceEntry);
      missing.inputBinding.roleHashes[role] = null;
      assert.equal(derivePageInputBindingProof(missing, [specimen]).complete, false, `${childId}:${role}:missing`);
    }
    const mixedTurn = structuredClone(coherentTurnFacts);
    mixedTurn.conversationTurnBindings = [{ assistantTurnIdHash: continuationExpected.assistantTurnIdHash,
      precedingPromptHash: hash("other-prompt"), responseHash: hash("other-response"), turnMarkerHashes: [hash("other-marker")] },
    { assistantTurnIdHash: hash("conversation-turn-4"), precedingPromptHash: continuationExpected.promptHash,
      responseHash: continuationExpected.responseHash, turnMarkerHashes: [continuationExpected.turnMarkerHash] }];
    assert.equal(derivePageInputBindingProof(traceEntry,
      [{ ...specimen, stateFacts: mixedTurn }]).complete, false, `${childId}:mixed-turn`);
  }

  const inputMismatchRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-input-mismatch-"));
  const inputMismatch = inputs(inputMismatchRoot);
  inputMismatch.productionSource.actualTrace[0].inputBinding.roleHashes.promptHash = hash("different-production-prompt");
  inputMismatch.productionSource.traceDigest = hash(JSON.stringify(stable(inputMismatch.productionSource.actualTrace)));
  const inputMismatchCaptureResult = await runAssembler(inputMismatch);
  const inputMismatchCapture = JSON.parse(await readFile(inputMismatchCaptureResult.output, "utf8"));
  assert.equal(inputMismatchCapture.productRun.calls[0].captureComplete, false);
  assert.ok(inputMismatchCapture.productRun.calls[0].gaps.includes("PAGE_INPUT_BINDING_GAP:promptHash"));

  const legacyFailureRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-legacy-failure-"));
  const legacyFailure = inputs(legacyFailureRoot);
  legacyFailure.productionSource.taskStatus = "failed";
  legacyFailure.productionSource.flowStatus = "OBSERVED_COMPLETE_PATH";
  legacyFailure.productionSource.terminalBranch = "production-failure";
  legacyFailure.productionSource.actualTrace[0].resultStatus = "failed";
  legacyFailure.productionSource.traceDigest = hash(JSON.stringify(stable(legacyFailure.productionSource.actualTrace)));
  delete legacyFailure.productionSource.terminalBranchProof;
  const rejectedLegacy = await runAssembler(legacyFailure, 1);
  assert.match(rejectedLegacy.result.stderr, /PRODUCTION_SOURCE_INVALID/u);

  const repeatedRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-repeat-"));
  const repeated = await runAssembler(inputs(repeatedRoot, 2, false));
  const repeatedCapture = JSON.parse(await readFile(repeated.output, "utf8"));
  assert.ok(repeatedCapture.productRun.calls.every((call) => call.captureComplete === false));
  assert.ok(repeatedCapture.productRun.calls.every((call) => call.gaps.includes("PAGE_EVIDENCE_GAP:product-call-scene-map-missing")));

  const duplicateRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-duplicate-exact-call-"));
  const duplicateMapped = await runAssembler(inputs(duplicateRoot, 2, true, true));
  const duplicateCapture = JSON.parse(await readFile(duplicateMapped.output, "utf8"));
  assert.equal(new Set(duplicateCapture.productRun.calls.map((call) => call.exactCallIdentityHash)).size, 1);
  assert.equal(new Set(duplicateCapture.productRun.calls.map((call) => call.traceEntryId)).size, 2);
  assert.ok(duplicateCapture.productRun.calls.every((call) => call.captureComplete === true));

  const actualBranchRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-actual-branch-"));
  const actualBranch = inputs(actualBranchRoot);
  const actualBranchTraceId = actualBranch.productionSource.actualTrace[0].traceEntryId;
  delete actualBranch.mapping.productCalls[actualBranchTraceId].states["confirmed-submit-effect-readback"];
  const actualBranchResult = await runAssembler(actualBranch);
  const actualBranchCapture = JSON.parse(await readFile(actualBranchResult.output, "utf8"));
  assert.deepEqual(actualBranchCapture.productRun.calls[0].pageRequirementSnapshot.requiredLiveStates,
    ["pre-submit-ready", "post-submit-user-turn"]);
  assert.equal(actualBranchCapture.productRun.calls[0].captureComplete, true);
  assert.deepEqual(productRunFailures(actualBranchCapture.productRun,
    stable(actualBranchCapture.productionSource), actualBranch.matrix, actualBranch.inventory,
    actualBranchCapture), []);

  const unknownStateRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-unknown-state-"));
  const unknownState = inputs(unknownStateRoot);
  const unknownStateTraceId = unknownState.productionSource.actualTrace[0].traceEntryId;
  unknownState.mapping.productCalls[unknownStateTraceId].states["invented-state"] = "pre-ready";
  const unknownStateRejected = await runAssembler(unknownState, 1);
  assert.match(unknownStateRejected.result.stderr, /PRODUCT_CALL_STATE_OUT_OF_SCOPE/u);

  const reusedRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-cross-call-reuse-"));
  const reused = inputs(reusedRoot, 2, true, true);
  reused.mapping.productCalls[reused.productionSource.actualTrace[1].traceEntryId]
    = reused.mapping.productCalls[reused.productionSource.actualTrace[0].traceEntryId];
  const reusedRejected = await runAssembler(reused, 1);
  assert.match(reusedRejected.result.stderr, /PRODUCT_CALL_SCENE_CROSS_CALL_REUSE_FORBIDDEN/u);

  const oldMappingRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-old-mapping-"));
  const oldMapping = inputs(oldMappingRoot);
  const oldTraceId = oldMapping.productionSource.actualTrace[0].traceEntryId;
  oldMapping.mapping.productCalls[oldTraceId] = { sceneIds: ["pre-ready"] };
  const oldMappingRejected = await runAssembler(oldMapping, 1);
  assert.match(oldMappingRejected.result.stderr, /PRODUCT_CALL_MAPPING_SCHEMA_INVALID/u);

  const secondTruthRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-child-second-truth-"));
  const secondTruth = inputs(secondTruthRoot);
  secondTruth.mapping.children = { submit_exact_gpt_turn_once: { states: {} } };
  const secondTruthRejected = await runAssembler(secondTruth, 1);
  assert.match(secondTruthRejected.result.stderr, /MAPPING_CHILD_SECOND_TRUTH_FORBIDDEN/u);

  const invalidRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-invalid-source-"));
  const invalid = inputs(invalidRoot);
  invalid.productionSource.synthetic = true;
  const rejected = await runAssembler(invalid, 1);
  assert.match(rejected.result.stderr, /PRODUCTION_SOURCE_INVALID/u);

  const collectorSource = await readFile(COLLECTOR, "utf8");
  assert.doesNotMatch(collectorSource,
    /process\.argv|function\s+main\s*\(|from\s+["']playwright["']|\.click\s*\(|\.fill\s*\(|\.press\s*\(|setInputFiles|\.goto\s*\(|waitForEvent|setTimeout/u);

  const corrupt = join(root, "corrupt-scenes.json");
  await writeFile(corrupt, "{not-json");
  await assert.rejects(() => createChromeSceneCollector({
    tab: { playwright: {}, url: async () => "https://chatgpt.com/" }, outputPath: corrupt,
    productMarker: "product-turn-marker", runId, captureEpoch: binding.captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE" }, qaTabIdentityHash: binding.qaTabIdentityHash,
  }), /SCENE_STORE_CORRUPT/u);

  process.stdout.write("gpt-product-page-evidence-pipeline-acceptance-ok\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
