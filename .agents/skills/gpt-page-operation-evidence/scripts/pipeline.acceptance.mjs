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
import { requiredLiveStatesForTrace } from "./trace-page-requirements.mjs";

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

const terminalBranchRequirement = {
  requiredLiveStates: ["generating", "stable", "readback", "terminal-error"],
  traceResultStatuses: {
    generating: ["success", "failed"], stable: ["success"], readback: ["success"],
    "terminal-error": ["failed"],
  },
  stateAssertions: { generating: [], stable: [], readback: [], "terminal-error": [] },
};
assert.deepEqual(requiredLiveStatesForTrace(terminalBranchRequirement,
  { resultStatus: "success", mutationOutcome: "no", browserReceipts: [{}] }),
["generating", "stable", "readback"]);
assert.deepEqual(requiredLiveStatesForTrace(terminalBranchRequirement,
  { resultStatus: "failed", mutationOutcome: "no", browserReceipts: [{}] }),
["generating", "terminal-error"]);

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
    resultStatus: "success", mutationOutcome: "confirmed", postconditionResult: "passed",
    candidateCardinality: { raw: 1, eligible: 1 }, observationRevisionHash: hash(`revision-${index}`),
    inputBinding: {
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
      contract: { profile: "PROVIDER_EFFECT_ONCE", allowedDocumentTransition: "forbidden" },
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
    }, childSpecificDerivedStates: [], stateAssertions: {
      "pre-submit-ready": [{ path: "stateFacts.capturePhase", operator: "equals", value: "PRE_ACTION" }],
      "post-submit-user-turn": [
        { path: "related.transitionChain.typedCommand.kind", operator: "equals",
          value: "CAPTURED_BROWSER_COMMAND" },
        { path: "related.transitionChain.directPostcondition.passed", operator: "equals", value: true },
      ],
      "confirmed-submit-effect-readback": [{ path: "related.transitionChain.typedCommand.kind", operator: "equals",
        value: "ZERO_ACTION" }],
    },
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
      postconditionPassed: true,
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
            children: [{ kind: "TEXT", value: "private product text" },
              { kind: "TEXT", value: "高" }] },
        ] },
        rect: { x: 1, y: 2, width: 30, height: 40 },
        style: { display: "block", visibility: "visible", opacity: "1" }, connected: true,
        directText: "private product text", subtreeText: "private product text",
        machineFacts: {}, ancestors: [{ tag: "main" }], siblings: [], media: null,
      }, {
        tag: "div", attributes: { role: "menuitem", "aria-label": "选择模型" },
        domTree: { kind: "ELEMENT", tag: "div", attributes: { role: "menuitem", "aria-label": "选择模型" },
          children: [] },
        rect: { x: 1, y: 2, width: 30, height: 40 },
        style: { display: "block", visibility: "visible", opacity: "1" }, connected: true,
        directText: "", subtreeText: "", machineFacts: {}, ancestors: [{ tag: "main" }], siblings: [], media: null,
      }, {
        tag: "div", attributes: { "aria-label": "高" },
        domTree: { kind: "ELEMENT", tag: "div", attributes: { "aria-label": "高" },
          children: [{ kind: "TEXT", value: "高" }] },
        rect: { x: 1, y: 2, width: 30, height: 40 },
        style: { display: "block", visibility: "visible", opacity: "1" }, connected: true,
        directText: "高", subtreeText: "高", machineFacts: {}, ancestors: [{ tag: "main" }], siblings: [], media: null,
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
  assert.equal(collected.nodes[0].sanitizedDomTree.children[0].children[1].kind, "HASH_ONLY_TEXT",
    "allowlisted UI words inside non-interactive business text must stay hash-only");
  assert.equal(collected.nodes[1].attributes["aria-label"], "选择模型",
    "allowlisted aria labels require matching interactive UI semantics");
  assert.equal(collected.nodes[2].attributes["aria-label"].kind, "HASH_ONLY",
    "an allowlisted word on a non-interactive aria-label must stay hash-only");
  assert.equal(collected.nodes[2].textProjection.kind, "HASH_ONLY",
    "an allowlisted word on non-interactive business text must stay hash-only");
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
    postconditionPassed: true,
    debugNote: "must-not-pass",
  } }), /CHROME_SCENE_TRANSITION_RECEIPT_INVALID/u);

  const baseline = await runAssembler(inputs(root));
  const capture = JSON.parse(await readFile(baseline.output, "utf8"));
  assert.equal(capture.schemaVersion, "gpt-page-operation-capture.v6");
  assert.equal(capture.productionSource.synthetic, false);
  const baselineInputs = inputs(root);
  const expectedSceneIds = new Set(Object.values(baselineInputs.mapping.productCalls)
    .flatMap((entry) => Object.values(entry.states)));
  for (const sceneId of [...expectedSceneIds]) {
    const preSceneId = baselineInputs.scenes.find((entry) => entry.sceneId === sceneId)
      ?.transitionReceipt?.preSceneId;
    if (preSceneId) expectedSceneIds.add(preSceneId);
  }
  assert.deepEqual(capture.sceneManifest.map((entry) => entry.sceneId).sort(), [...expectedSceneIds].sort());
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

  const imagePromptHash = hash("image prompt");
  const imageMarkerHash = hash("[GRASSEYE:333333333333333333333333]");
  const imageTurn = node({ "data-testid": "conversation-turn-6" });
  imageTurn.machineFacts.userRoleDescendants = 0;
  imageTurn.machineFacts.assistantRoleDescendants = 0;
  const semanticImage = node({}, false, "conversation-turn-6");
  semanticImage.tag = "img";
  semanticImage.media = { complete: true, naturalWidth: 1672, naturalHeight: 941, altLength: 12 };
  const imageOnlyScene = { nodes: [imageTurn, semanticImage], pageFacts: {
    conversationTurnBindings: [{ assistantTurnIdHash: hash("conversation-turn-6"),
      precedingPromptHash: imagePromptHash, responseHash: hash(""), turnMarkerHashes: [imageMarkerHash] }],
  } };
  const imageCandidateContext = { imageChild: true, expectedPageInputRoles: {
    promptHash: imagePromptHash, responseHash: null, turnMarkerHash: imageMarkerHash,
    assistantTurnIdHash: null,
  } };
  assert.equal(candidateEntries("assistant-turn", imageOnlyScene, imageCandidateContext).length, 1,
    "image assistant section must not require an inner assistant-role node");
  assert.equal(candidateEntries("semantic-media-node", imageOnlyScene, imageCandidateContext).length, 1,
    "semantic media must bind to the prompt-owned outer image section");

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

  const promptOnlyRoles = { promptHash, responseHash: null, attachmentLabelHashes: null,
    attachmentSetHash: null, modelDisplayNameHash: null, reasoningRequirement: null,
    conversationUrlHash: null, turnMarkerHash: null, assistantTurnIdHash: null };
  const writeTrace = { childId: "write_exact_gpt_prompt", inputBinding: {
    schemaVersion: "gpt-page-input-binding.v1", source: "FORENSICS_SAFE_PROJECTION",
    inputHash: hash("write-input"), roleHashes: promptOnlyRoles } };
  const wrongComposerWithOldTurn = { evidenceKind: "LIVE_PAGE", sourceSceneId: "write-wrong-source",
    stateId: "exact-prompt-after", core: { targets: { composer: { observed: true } } }, stateFacts: {
      exactComposerHash: hash("wrong composer"), exactUserPromptHashes: [promptHash],
      userTurnBindings: [{ userTurnIdHash: hash("conversation-turn-1"), promptHash, turnMarkerHashes: [] }],
    } };
  assert.equal(derivePageInputBindingProof(writeTrace, [wrongComposerWithOldTurn]).complete, false,
    "write prompt must bind the post-write composer, not an old user turn");
  const exactComposer = structuredClone(wrongComposerWithOldTurn);
  exactComposer.stateFacts.exactComposerHash = promptHash;
  assert.equal(derivePageInputBindingProof(writeTrace, [exactComposer]).complete, true);

  const submitTrace = { childId: "submit_exact_gpt_turn_once", inputBinding: {
    schemaVersion: "gpt-page-input-binding.v1", source: "FORENSICS_SAFE_PROJECTION",
    inputHash: hash("submit-input"), roleHashes: { ...promptOnlyRoles,
      attachmentLabelHashes: [], attachmentSetHash: emptyAttachmentSetHash } } };
  const targetOwner = hash("conversation-turn-3");
  const wrongTargetUserTurn = { evidenceKind: "LIVE_PAGE", sourceSceneId: "submit-wrong-source",
    stateId: "post-submit-user-turn", core: { targets: { "user-turn": { ownerTurnIdHash: targetOwner } } },
    stateFacts: { exactComposerHash: promptHash, exactUserPromptHashes: [promptHash], attachmentLabelHashes: [],
      userTurnBindings: [{ userTurnIdHash: hash("conversation-turn-1"), promptHash, turnMarkerHashes: [] },
        { userTurnIdHash: targetOwner, promptHash: hash("different submitted prompt"), turnMarkerHashes: [] }] } };
  assert.equal(derivePageInputBindingProof(submitTrace, [wrongTargetUserTurn]).complete, false,
    "submit prompt must bind the selected post-submit user turn");
  const exactTargetUserTurn = structuredClone(wrongTargetUserTurn);
  exactTargetUserTurn.stateFacts.userTurnBindings[1].promptHash = promptHash;
  assert.equal(derivePageInputBindingProof(submitTrace, [exactTargetUserTurn]).complete, true);

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

  const diagnosticRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-diagnostic-dom-"));
  const diagnostic = inputs(diagnosticRoot);
  const diagnosticPost = diagnostic.scenes.find((entry) => entry.sceneId === "post-user");
  diagnosticPost.nodes[0] = structuredClone(diagnosticPost.nodes[0]);
  diagnosticPost.nodes[0].style.display = "none";
  diagnosticPost.observationRevisionHash = hash(JSON.stringify({
    documentIdentityHash: diagnosticPost.documentIdentityHash, url: diagnosticPost.url,
    nodes: diagnosticPost.nodes, pageFacts: diagnosticPost.pageFacts,
  }));
  diagnosticPost.stateSignature = sceneSignature(diagnosticPost);
  const diagnosticResult = await runAssembler(diagnostic);
  const diagnosticCapture = JSON.parse(await readFile(diagnosticResult.output, "utf8"));
  const diagnosticCall = diagnosticCapture.productRun.calls[0];
  const failedSpecimen = diagnosticCall.domEvidence.specimens.find((entry) =>
    entry.stateId === "post-submit-user-turn");
  assert.equal(diagnosticCall.captureComplete, false);
  assert.ok(diagnosticCall.gaps.some((gap) => gap.includes(
    "PAGE_EVIDENCE_CONFLICT:target-not-unique:user-turn:raw=1:qualified=0",
  )));
  assert.equal(failedSpecimen.core.actionQualification.qualified, false);
  assert.ok(failedSpecimen.core.targets["user-turn"].diagnosticDom.sanitizedOuterHtml.length > 0);

  const underCapturedRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-undercaptured-"));
  const underCaptured = inputs(underCapturedRoot);
  const underCapturedTraceId = underCaptured.productionSource.actualTrace[0].traceEntryId;
  delete underCaptured.mapping.productCalls[underCapturedTraceId].states["pre-submit-ready"];
  delete underCaptured.mapping.productCalls[underCapturedTraceId].states["confirmed-submit-effect-readback"];
  const underCapturedResult = await runAssembler(underCaptured);
  const underCapturedCapture = JSON.parse(await readFile(underCapturedResult.output, "utf8"));
  assert.deepEqual(underCapturedCapture.productRun.calls[0].pageRequirementSnapshot.requiredLiveStates,
    ["pre-submit-ready", "post-submit-user-turn"]);
  assert.equal(underCapturedCapture.productRun.calls[0].captureComplete, false);
  assert.ok(underCapturedCapture.productRun.calls[0].gaps
    .includes("PAGE_EVIDENCE_GAP:pre-submit-ready:scene-not-mapped"));

  const noActionRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-no-action-"));
  const noAction = inputs(noActionRoot);
  const noActionTraceId = noAction.productionSource.actualTrace[0].traceEntryId;
  noAction.productionSource.actualTrace[0].mutationOutcome = "no";
  noAction.productionSource.actualTrace[0].browserReceipts = [];
  noAction.productionSource.traceDigest = hash(JSON.stringify(stable(noAction.productionSource.actualTrace)));
  noAction.mapping.productCalls[noActionTraceId].states = {
    "confirmed-submit-effect-readback": "confirmed-user",
  };
  const noActionResult = await runAssembler(noAction);
  const noActionCapture = JSON.parse(await readFile(noActionResult.output, "utf8"));
  assert.deepEqual(noActionCapture.productRun.calls[0].pageRequirementSnapshot.requiredLiveStates,
    ["confirmed-submit-effect-readback"]);
  assert.equal(noActionCapture.productRun.calls[0].captureComplete, true);

  const preBrowserFailureRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-pre-browser-failure-"));
  const preBrowserFailure = inputs(preBrowserFailureRoot);
  const failedTrace = preBrowserFailure.productionSource.actualTrace[0];
  failedTrace.resultStatus = "failed";
  failedTrace.mutationOutcome = "no";
  failedTrace.postconditionResult = "failed";
  failedTrace.failureCode = "BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN";
  failedTrace.browserReceipts = [];
  failedTrace.candidateCardinality = { raw: null, eligible: null };
  failedTrace.observationRevisionHash = null;
  preBrowserFailure.productionSource.traceDigest = hash(JSON.stringify(stable(
    preBrowserFailure.productionSource.actualTrace,
  )));
  preBrowserFailure.productionSource.terminalBranch = "production-failure";
  preBrowserFailure.productionSource.terminalBranchProof = {
    kind: "DURABLE_FAILURE_AND_TRACE_TERMINAL", failedTraceEntryId: failedTrace.traceEntryId,
    terminalSource: "ATTEMPT_FAILURE_ROW", durableFailureReceiptHash: hash("failure-row"),
    durableFailureCodeHash: hash(failedTrace.failureCode), traceFailureCodeHash: hash(failedTrace.failureCode),
    codeRelation: "EXACT", childCorrelation: "MATCHED", evidenceCorrelation: "NOT_DECLARED",
  };
  preBrowserFailure.mapping.productCalls = {};
  const preBrowserFailureResult = await runAssembler(preBrowserFailure);
  const preBrowserFailureCapture = JSON.parse(await readFile(preBrowserFailureResult.output, "utf8"));
  assert.deepEqual(preBrowserFailureCapture.productRun.calls[0].pageRequirementSnapshot.requiredLiveStates, []);
  assert.deepEqual(preBrowserFailureCapture.productRun.calls[0].domEvidence.specimens, []);
  assert.equal(preBrowserFailureCapture.productRun.calls[0].captureComplete, true);
  assert.deepEqual(preBrowserFailureCapture.productRun.calls[0].gaps, []);
  assert.deepEqual(productRunFailures(preBrowserFailureCapture.productRun,
    stable(preBrowserFailureCapture.productionSource), preBrowserFailure.matrix,
    preBrowserFailure.inventory, preBrowserFailureCapture), []);

  const failedPostconditionRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-postcondition-failed-"));
  const failedPostcondition = inputs(failedPostconditionRoot);
  failedPostcondition.scenes.find((entry) => entry.sceneId === "post-user")
    .transitionReceipt.postconditionPassed = false;
  failedPostcondition.scenes.find((entry) => entry.sceneId === "post-user").stateSignature = sceneSignature(
    failedPostcondition.scenes.find((entry) => entry.sceneId === "post-user"),
  );
  failedPostcondition.mapping.productCalls[failedPostcondition.productionSource.actualTrace[0].traceEntryId]
    .states["post-submit-user-turn"] = "post-user";
  const failedPostconditionResult = await runAssembler(failedPostcondition);
  const failedPostconditionCapture = JSON.parse(await readFile(failedPostconditionResult.output, "utf8"));
  assert.equal(failedPostconditionCapture.productRun.calls[0].captureComplete, false);
  assert.ok(failedPostconditionCapture.productRun.calls[0].domEvidence.specimens
    .some((entry) => entry.stateId === "post-submit-user-turn"
      && entry.related.transitionChain.directPostcondition.passed === false));
  assert.ok(failedPostconditionCapture.productRun.calls[0].gaps.includes(
    "PAGE_EVIDENCE_CONFLICT:STATE_ASSERTION:post-submit-user-turn:related.transitionChain.directPostcondition.passed:equals",
  ));
  assert.deepEqual(productRunFailures(failedPostconditionCapture.productRun,
    stable(failedPostconditionCapture.productionSource), failedPostcondition.matrix,
    failedPostcondition.inventory, failedPostconditionCapture), []);

  const forbiddenTransitionRoot = await mkdtemp(join(tmpdir(), "gpt-product-pipeline-document-transition-"));
  const forbiddenTransition = inputs(forbiddenTransitionRoot);
  const forbiddenPost = forbiddenTransition.scenes.find((entry) => entry.sceneId === "post-user");
  forbiddenPost.documentIdentityHash = hash("unexpected-successor-document");
  forbiddenPost.observationRevisionHash = hash(JSON.stringify({
    documentIdentityHash: forbiddenPost.documentIdentityHash, url: forbiddenPost.url,
    nodes: forbiddenPost.nodes, pageFacts: forbiddenPost.pageFacts,
  }));
  forbiddenPost.stateSignature = sceneSignature(forbiddenPost);
  const forbiddenResult = await runAssembler(forbiddenTransition);
  const forbiddenCapture = JSON.parse(await readFile(forbiddenResult.output, "utf8"));
  assert.equal(forbiddenCapture.productRun.calls[0].captureComplete, false);
  assert.ok(forbiddenCapture.productRun.calls[0].domEvidence.specimens
    .some((entry) => entry.stateId === "post-submit-user-turn"
      && entry.documentIdentityHash === hash("unexpected-successor-document")));
  assert.ok(forbiddenCapture.productRun.calls[0].gaps.includes(
    "PAGE_EVIDENCE_CONFLICT:TRANSITION_DOCUMENT:post-submit-user-turn:forbidden-change",
  ));
  assert.deepEqual(productRunFailures(forbiddenCapture.productRun,
    stable(forbiddenCapture.productionSource), forbiddenTransition.matrix,
    forbiddenTransition.inventory, forbiddenCapture), []);

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
