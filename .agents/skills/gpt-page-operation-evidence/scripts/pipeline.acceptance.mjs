#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createChromeSceneCollector } from "./chrome-scene-collector.mjs";

const ASSEMBLER = resolve(new URL("./assemble-live-capture.mjs", import.meta.url).pathname);
const hash = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
const binding = {
  runId: "pipeline-acceptance",
  captureEpoch: hash("capture-epoch"),
  qaTabIdentityHash: hash("tab"),
};
const candidateBinding = { candidate: "WORKTREE:pipeline", worktreeDigest: hash("candidate") };
const matrixDigest = hash("matrix");
const demandDigest = hash("demand");

function sceneSignature(scene) {
  return hash(JSON.stringify({
    url: scene.url,
    activeTabIdentityHash: scene.activeTabIdentityHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash,
    nodeCount: scene.nodeCount,
    nodes: scene.nodes,
    pageFacts: scene.pageFacts,
    binding: scene.binding,
    decisionReceipt: scene.decisionReceipt,
    transitionReceipt: scene.transitionReceipt,
  }));
}

function refreshScene(scene) {
  scene.observationRevisionHash = hash(JSON.stringify({
    documentIdentityHash: scene.documentIdentityHash,
    url: scene.url,
    nodes: scene.nodes,
    pageFacts: scene.pageFacts,
  }));
  scene.stateSignature = sceneSignature(scene);
  return scene;
}

function node(attributes, text = "") {
  return {
    tag: "div",
    attributes,
    rect: { x: 1, y: 1, width: 20, height: 20 },
    style: { display: "block", visibility: "visible", opacity: "1" },
    connected: true,
    textProjection: { kind: "ALLOWLISTED", value: text },
    ancestors: [{ tag: "main" }],
    siblings: [],
  };
}

function scene(sceneId, nodes, receipt = null) {
  const value = {
    sceneId,
    capturedAt: `2026-09-06T00:00:${String(sceneId.length).padStart(2, "0")}.000Z`,
    url: `https://chatgpt.com/c/${hash("conversation")}`,
    activeTabIdentityHash: binding.qaTabIdentityHash,
    documentIdentityHash: hash("document"),
    observationRevisionHash: "",
    nodeCount: nodes.length,
    nodes,
    pageFacts: { currentRouteKind: "CONVERSATION" },
    binding,
    decisionReceipt: receipt?.decision ?? null,
    transitionReceipt: receipt?.transition ?? null,
  };
  value.observationRevisionHash = hash(JSON.stringify({
    documentIdentityHash: value.documentIdentityHash,
    url: value.url,
    nodes: value.nodes,
    pageFacts: value.pageFacts,
  }));
  return { ...value, stateSignature: sceneSignature(value) };
}

const composer = node({ id: "prompt-textarea", contenteditable: "true" });
const send = node({ "data-testid": "send-button", type: "button" });
const user = node({ "data-message-author-role": "user" }, "GPT-EVIDENCE-prompt");
function fixtureSet() {
  const pre = scene("pre-ready", [composer, send], { decision: {
    kind: "ACTION_REQUIRED", actionId: "action:submit", operation: "click",
  } });
  return [
    pre,
    scene("post-user", [user], { transition: {
      actionId: "action:submit", operation: "click",
      issuedAt: pre.capturedAt, completedAt: pre.capturedAt, outcome: "DISPATCH_RETURNED",
      preSceneId: pre.sceneId, preSceneSignature: pre.stateSignature,
    } }),
    scene("confirmed-user", [user], { decision: { kind: "ALREADY_SATISFIED" } }),
  ];
}

function inputs(directory, scenes, mappingPatch = {}) {
  const inventory = {
    candidateBinding,
    matrixBinding: { digest: matrixDigest },
    denominator: {
      contractChildren: 1,
      pageOperationChildren: 1,
      nonPageChildren: 0,
      pageOperationChildIds: ["submit_exact_gpt_turn_once"],
      nonPageChildIds: [],
    },
    children: [{
      childCapabilityId: "submit_exact_gpt_turn_once",
      contractVersion: 1,
      pageOperationRequired: true,
      contract: { profile: "PROVIDER_EFFECT_ONCE" },
      webImplementationReferences: [{ path: "src/capabilities/gpt/children/submit_exact_gpt_turn_once/handler.ts" }],
      collectionRequirements: { requiredInputRefs: ["synthetic-rich-text-prompt"] },
      evidenceDemand: {
        digest: demandDigest,
        childCandidateDigest: demandDigest,
        facts: [{ factId: "target:composer", expected: "composer" }],
        sourceBinding: { authority: { files: [], semanticDigest: hash("authority") }, consumers: { files: [] } },
      },
    }],
  };
  const matrix = {
    commonRequiredDerivedStates: ["candidate-missing"],
    chainInputSources: {},
    children: [{
      childCapabilityId: "submit_exact_gpt_turn_once",
      requiredInputRefs: ["synthetic-rich-text-prompt"],
      coreTargets: ["composer", "submit-control", "user-turn"],
      requiredLiveStates: ["pre-submit-ready", "post-submit-user-turn", "confirmed-submit-effect-readback"],
      liveStateTargets: {
        "pre-submit-ready": ["composer", "submit-control"],
        "post-submit-user-turn": ["user-turn"],
        "confirmed-submit-effect-readback": ["user-turn"],
      },
      childSpecificDerivedStates: [],
    }],
  };
  const mapping = {
    authorizedInputs: {},
    children: { submit_exact_gpt_turn_once: { states: {
      "pre-submit-ready": "pre-ready",
      "post-submit-user-turn": "post-user",
      "confirmed-submit-effect-readback": "confirmed-user",
      ...mappingPatch,
    }, supportScenes: ["support-only"] } },
  };
  return { inventory, matrix, mapping, scenes, fixture: {
    schemaVersion: "gpt-page-operation-fixtures.v2",
    runId: binding.runId,
    syntheticOnly: true,
    inputs: { "synthetic-rich-text-prompt": { kind: "SYNTHETIC_FIXTURE", value: "GPT-EVIDENCE-prompt", sha256: hash("GPT-EVIDENCE-prompt"), length: 19 } },
  }, browser: {
    captureEpoch: binding.captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE", scope: ["pipeline-acceptance"], requestedAt: "2026-09-06T00:00:00.000Z" },
    browser: { family: "chrome", version: "acceptance", controlSkill: "chrome:control-chrome", dedicatedQaTab: true,
      qaTabCreatedByRun: true, livePageObserved: true, productionBrowserIdleEvidence: { observed: true }, qaTabIdentityHash: binding.qaTabIdentityHash },
    environment: { locale: "zh-CN", viewport: { width: 1200, height: 800 }, theme: "light", providerBuildMarker: hash("build") },
  }, directory };
}

async function runAssembler(data, expected = 0) {
  for (const [name, value] of Object.entries(data)) {
    if (["directory"].includes(name)) continue;
    await writeFile(join(data.directory, `${name}.json`), `${JSON.stringify(value)}\n`);
  }
  const output = join(data.directory, "output.json");
  const result = spawnSync(process.execPath, [ASSEMBLER,
    "--inventory", join(data.directory, "inventory.json"),
    "--matrix", join(data.directory, "matrix.json"),
    "--scenes", join(data.directory, "scenes.json"),
    "--mapping", join(data.directory, "mapping.json"),
    "--fixtures", join(data.directory, "fixture.json"),
    "--browser-meta", join(data.directory, "browser.json"),
    "--output", output,
  ], { encoding: "utf8" });
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return { result, output };
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-v5-"));
  const baseline = await runAssembler(inputs(root, fixtureSet()));
  const capture = JSON.parse(await readFile(baseline.output, "utf8"));
  const child = capture.children[0];
  assert.equal(child.specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE").length, 3);
  assert.ok(child.specimens.every((entry) => entry.evidenceKind !== "LIVE_PAGE"
    || entry.related.transitionChain.typedCommand.kind !== "EVIDENCE_MISSING"));

  const noReceiptDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-no-receipt-"));
  const noReceiptScenes = fixtureSet().map((entry) => ({
    ...entry, transitionReceipt: null, decisionReceipt: null,
  })).map((entry) => ({ ...entry, stateSignature: sceneSignature(entry) }));
  const noReceipt = await runAssembler(inputs(noReceiptDirectory, noReceiptScenes));
  const noReceiptCapture = JSON.parse(await readFile(noReceipt.output, "utf8"));
  assert.ok(noReceiptCapture.children[0].specimens.some((entry) => entry.evidenceKind === "LIVE_PAGE"
    && entry.related.transitionChain.typedCommand.kind === "EVIDENCE_MISSING"));

  const reusedDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-reused-"));
  const reused = await runAssembler(inputs(reusedDirectory, fixtureSet(), {
    "confirmed-submit-effect-readback": "post-user",
  }), 1);
  assert.match(reused.result.stderr, /CHILD_STATE_SCENE_REUSE_FORBIDDEN/u);

  const duplicateDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-duplicate-"));
  const duplicated = fixtureSet();
  duplicated.push(structuredClone(duplicated[0]));
  const duplicate = await runAssembler(inputs(duplicateDirectory, duplicated), 1);
  assert.match(duplicate.result.stderr, /SCENE_ID_DUPLICATE/u);

  const ambiguousDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-ambiguous-"));
  const ambiguous = fixtureSet();
  ambiguous[0].nodes.push(send);
  ambiguous[0].nodeCount = ambiguous[0].nodes.length;
  refreshScene(ambiguous[0]);
  ambiguous[1].transitionReceipt.preSceneSignature = ambiguous[0].stateSignature;
  refreshScene(ambiguous[1]);
  const ambiguousRun = await runAssembler(inputs(ambiguousDirectory, ambiguous));
  const ambiguousCapture = JSON.parse(await readFile(ambiguousRun.output, "utf8"));
  assert.ok(!ambiguousCapture.children[0].specimens.some((entry) => entry.stateId === "pre-submit-ready"));

  const candidateDriftDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-candidate-drift-"));
  const candidateDrift = inputs(candidateDriftDirectory, fixtureSet());
  candidateDrift.inventory.candidateBinding = { candidate: "HEAD:new-code", worktreeDigest: hash("new-code") };
  const candidateDriftRun = await runAssembler(candidateDrift);
  const candidateDriftCapture = JSON.parse(await readFile(candidateDriftRun.output, "utf8"));
  assert.equal(candidateDriftCapture.children[0].specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE").length, 3);

  const staleMatrixDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-stale-matrix-"));
  const staleMatrix = inputs(staleMatrixDirectory, fixtureSet());
  staleMatrix.inventory.matrixBinding.digest = hash("new-matrix");
  const staleMatrixRun = await runAssembler(staleMatrix);
  const staleMatrixCapture = JSON.parse(await readFile(staleMatrixRun.output, "utf8"));
  assert.equal(staleMatrixCapture.children[0].specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE").length, 3);

  const staleDemandDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-stale-demand-"));
  const staleDemand = inputs(staleDemandDirectory, fixtureSet());
  staleDemand.inventory.children[0].evidenceDemand.digest = hash("new-demand");
  staleDemand.inventory.children[0].evidenceDemand.childCandidateDigest = hash("new-demand");
  const staleDemandRun = await runAssembler(staleDemand);
  const staleDemandCapture = JSON.parse(await readFile(staleDemandRun.output, "utf8"));
  assert.equal(staleDemandCapture.children[0].specimens.filter((entry) => entry.evidenceKind === "LIVE_PAGE").length, 3);

  const staleEpochDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-stale-epoch-"));
  const staleEpoch = fixtureSet();
  staleEpoch[0].binding = { ...staleEpoch[0].binding, captureEpoch: hash("previous-epoch") };
  refreshScene(staleEpoch[0]);
  const staleEpochRun = await runAssembler(inputs(staleEpochDirectory, staleEpoch), 1);
  assert.match(staleEpochRun.result.stderr, /SCENE_BINDING_STALE/u);

  const forbiddenDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-recapture-forbidden-"));
  const forbiddenInput = inputs(forbiddenDirectory, fixtureSet());
  delete forbiddenInput.browser.recaptureTrigger;
  const forbiddenRun = await runAssembler(forbiddenInput, 1);
  assert.match(forbiddenRun.result.stderr, /RECAPTURE_FORBIDDEN/u);

  const inertAncestorDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-inert-ancestor-"));
  const inertAncestor = fixtureSet();
  inertAncestor[0].nodes[1] = { ...inertAncestor[0].nodes[1], machineFacts: { inertAncestor: true } };
  refreshScene(inertAncestor[0]);
  inertAncestor[1].transitionReceipt.preSceneSignature = inertAncestor[0].stateSignature;
  refreshScene(inertAncestor[1]);
  const inertAncestorRun = await runAssembler(inputs(inertAncestorDirectory, inertAncestor));
  const inertAncestorCapture = JSON.parse(await readFile(inertAncestorRun.output, "utf8"));
  assert.ok(!inertAncestorCapture.children[0].specimens.some((entry) => entry.stateId === "pre-submit-ready"));

  const corrupt = join(root, "corrupt-scenes.json");
  await writeFile(corrupt, "{not-json");
  await assert.rejects(() => createChromeSceneCollector({
    tab: { playwright: {}, url: async () => "https://chatgpt.com/" },
    outputPath: corrupt,
    syntheticMarker: "GPT-EVIDENCE-",
    runId: binding.runId,
    captureEpoch: binding.captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE" },
    qaTabIdentityHash: binding.qaTabIdentityHash,
  }), /SCENE_STORE_CORRUPT/u);

  const hydratedDirectory = await mkdtemp(join(tmpdir(), "gpt-page-pipeline-hydrated-navigation-"));
  let currentUrl = "https://chatgpt.com/";
  let syntheticTurnHydrated = false;
  const hydratedTab = {
    id: "pipeline-hydrated-tab",
    playwright: {
      locator: (selector) => selector === "[data-message-author-role='user']"
        ? { evaluateAll: async () => syntheticTurnHydrated ? 1 : 0 }
        : selector === "main"
          ? { count: async () => 1 }
          : { count: async () => 1, evaluateAll: async () => ({
            nodes: [], currentUrl, documentTimeOrigin: 1,
          }) },
    },
    url: async () => currentUrl,
    goto: async (value) => {
      currentUrl = value;
      setTimeout(() => { syntheticTurnHydrated = true; }, 25);
    },
  };
  const hydratedCollector = await createChromeSceneCollector({
    tab: hydratedTab,
    outputPath: join(hydratedDirectory, "scenes.json"),
    syntheticMarker: "GPT-EVIDENCE-",
    runId: binding.runId,
    captureEpoch: binding.captureEpoch,
    recaptureTrigger: { kind: "HUMAN_REQUESTED_RECAPTURE" },
    qaTabIdentityHash: hash("pipeline-hydrated-tab"),
  });
  const hydratedScene = await hydratedCollector.performAndCollect({
    actionId: "focus-hydrated-conversation",
    operation: "goto",
    locator: {},
    preSceneId: "focus-before",
    postSceneId: "focus-after",
    value: "https://chatgpt.com/c/synthetic",
    postcondition: "synthetic-conversation-hydrated",
  });
  assert.equal(hydratedScene.transitionReceipt?.outcome, "DISPATCH_RETURNED");
  assert.equal(syntheticTurnHydrated, true);

  process.stdout.write("gpt-page-evidence-pipeline-acceptance-ok\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
