#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  derivePageInputBindingProof,
  pageInputBindingValid,
} from "./page-input-binding.mjs";
import { captureTimePageRequirementSnapshot, pageEvidenceNotApplicableForTrace,
  requiredLiveStatesForTrace, stateAssertionFailures, transitionEvidenceFailures }
  from "./trace-page-requirements.mjs";

const CAPTURE_SCHEMA = "gpt-page-operation-capture.v6";
const PRODUCTION_SOURCE_SCHEMA = "gpt-page-operation-production-source.v1";

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--") || !argv[index + 1]) fail("ARGUMENT_INVALID", token);
    result[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const sha256 = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
const sealedProductCall = (value) => {
  const body = stable(value);
  return stable({ ...body, derivationEnvelopeHash: sha256(JSON.stringify(body)) });
};
const attributesOf = (node) => node?.attributes ?? {};
const textOf = (node) => node?.textProjection?.value ?? "";
const subtreeTextOf = (node) => node?.subtreeTextProjection?.value ?? "";

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { fail("JSON_READ_FAILED", `${path}:${error instanceof Error ? error.message : String(error)}`); }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

function sceneContentSignature(scene) {
  return sha256(JSON.stringify({
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

function valueAtPath(root, path) {
  return path.split(".").reduce((value, part) => value && typeof value === "object" ? value[part] : undefined, root);
}

function safeTextProjection(node) {
  const projection = node?.textProjection ?? {};
  if (projection.kind === "HASH_ONLY") return {
    kind: "HASH_ONLY", sha256: projection.sha256, length: projection.length,
  };
  const value = typeof projection.value === "string" ? projection.value : "";
  return { kind: "ALLOWLISTED_UI", value, sha256: sha256(value), length: value.length };
}

function safeSubtreeProjection(node) {
  const projection = node?.subtreeTextProjection ?? {};
  if (projection.kind === "ALLOWLISTED" && typeof projection.value === "string") return {
    kind: "ALLOWLISTED_UI", value: projection.value, sha256: sha256(projection.value), length: projection.value.length,
  };
  return projection.kind === "HASH_ONLY" && typeof projection.sha256 === "string"
    && Number.isInteger(projection.length) && projection.length >= 0
    ? { kind: "HASH_ONLY", sha256: projection.sha256, length: projection.length }
    : { kind: "HASH_ONLY", sha256: sha256(""), length: 0 };
}

function nodeIdentity(scene, nodeIndex, node) {
  return sha256(JSON.stringify(stable({
    sceneSignature: scene.stateSignature,
    nodeIndex,
    tag: node.tag,
    attributes: attributesOf(node),
    rect: node.rect,
    textProjection: node.textProjection,
    media: node.media,
  })));
}

function eligible(entry, { hiddenAllowed = false, ariaHiddenAllowed = false } = {}) {
  const attrs = attributesOf(entry.node);
  const rect = entry.node.rect ?? {};
  if (entry.node.connected === false || attrs.disabled !== undefined || attrs.hidden !== undefined
    || attrs.inert !== undefined || (!ariaHiddenAllowed && attrs["aria-hidden"] === "true")
    || entry.node.machineFacts?.inertAncestor === true
    || (!ariaHiddenAllowed && entry.node.machineFacts?.ariaHiddenAncestor === true)) return false;
  if (hiddenAllowed) return true;
  return entry.node.style?.display !== "none" && entry.node.style?.visibility !== "hidden"
    && Number(entry.node.style?.opacity ?? 1) !== 0 && rect.width > 0 && rect.height > 0;
}

function sceneEntries(scene) {
  return scene.nodes.map((node, nodeIndex) => ({ scene, node, nodeIndex }));
}

function virtualEntry(scene, target, markerObserved) {
  const isConversation = /\/c\/sha256:[a-f0-9]{64}$/u.test(scene.url);
  if (target === "conversation-link-or-route" && /^https:\/\/chatgpt\.com\/(?:$|c\/sha256:)/u.test(scene.url)) {
    return { scene, nodeIndex: 0, node: { tag: "virtual-route", attributes: { kind: "SANITIZED_CURRENT_URL", conversation: String(isConversation) }, rect: { x: 0, y: 0, width: 1, height: 1 }, style: { display: "virtual", visibility: "visible", opacity: "1" }, connected: true, textProjection: { kind: "HASH_ONLY", sha256: sha256(scene.url), length: scene.url.length } } };
  }
  if (target === "conversation-identity-evidence" && isConversation && markerObserved) {
    return { scene, nodeIndex: 0, node: { tag: "virtual-conversation-identity", attributes: { kind: "ROUTE_AND_PRODUCT_TURN_MARKER" }, rect: { x: 0, y: 0, width: 1, height: 1 }, style: { display: "virtual", visibility: "visible", opacity: "1" }, connected: true, textProjection: { kind: "HASH_ONLY", sha256: sha256(`${scene.url}:${markerObserved}`), length: String(markerObserved).length } } };
  }
  return null;
}

export function candidateEntries(target, scene, candidateContext = {}) {
  const entries = sceneEntries(scene);
  const attr = (entry, name) => attributesOf(entry.node)[name];
  const ownerTurnHash = (entry) => {
    const owner = entry.node.machineFacts?.ownerTurnTestId ?? attr(entry, "data-testid");
    return typeof owner === "string" && owner.length > 0 ? sha256(owner) : null;
  };
  const expectedTurn = candidateContext.expectedPageInputRoles ?? {};
  const assistantBound = [expectedTurn.promptHash, expectedTurn.responseHash, expectedTurn.turnMarkerHash,
    expectedTurn.assistantTurnIdHash].some((value) => typeof value === "string");
  const matchingAssistantIds = new Set((scene.pageFacts?.conversationTurnBindings ?? [])
    .filter((binding) => (expectedTurn.promptHash === null || expectedTurn.promptHash === undefined
      || binding.precedingPromptHash === expectedTurn.promptHash)
      && (expectedTurn.responseHash === null || expectedTurn.responseHash === undefined
        || binding.responseHash === expectedTurn.responseHash)
      && (expectedTurn.turnMarkerHash === null || expectedTurn.turnMarkerHash === undefined
        || binding.turnMarkerHashes?.includes(expectedTurn.turnMarkerHash))
      && (expectedTurn.assistantTurnIdHash === null || expectedTurn.assistantTurnIdHash === undefined
        || binding.assistantTurnIdHash === expectedTurn.assistantTurnIdHash))
    .map((binding) => binding.assistantTurnIdHash));
  const assistantOwnerMatches = (entry) => !assistantBound || matchingAssistantIds.has(ownerTurnHash(entry));
  const userBound = [expectedTurn.promptHash, expectedTurn.turnMarkerHash]
    .some((value) => typeof value === "string");
  const matchingUserIds = new Set((scene.pageFacts?.userTurnBindings ?? [])
    .filter((binding) => (expectedTurn.promptHash === null || expectedTurn.promptHash === undefined
      || binding.promptHash === expectedTurn.promptHash)
      && (expectedTurn.turnMarkerHash === null || expectedTurn.turnMarkerHash === undefined
        || binding.turnMarkerHashes?.includes(expectedTurn.turnMarkerHash)))
    .map((binding) => binding.userTurnIdHash));
  const userOwnerMatches = (entry) => !userBound || matchingUserIds.has(ownerTurnHash(entry));
  const markerObserved = entries.find((entry) => entry.node.machineFacts?.productTurnMarkerObserved === true);
  const virtual = virtualEntry(scene, target, markerObserved ? markerObserved.node.textProjection?.sha256 ?? "observed" : "");
  if (virtual) return [virtual];
  const menus = entries.filter((entry) => attr(entry, "role") === "menu");
  const exactText = (value) => entries.filter((entry) => textOf(entry.node) === value);
  const virtualAggregate = (kind, candidates) => candidates.length === 0 ? [] : [{
    scene, nodeIndex: candidates[0].nodeIndex, node: {
      tag: "virtual-aggregate", attributes: { kind, count: String(candidates.length),
        setHash: sha256(JSON.stringify(candidates.map((entry) => attributesOf(entry.node)["aria-label"] ?? entry.node.textProjection).sort())) },
      rect: { x: 1, y: 1, width: 1, height: 1 }, style: { display: "virtual", visibility: "visible", opacity: "1" },
      connected: true, textProjection: { kind: "HASH_ONLY", sha256: sha256(kind), length: candidates.length },
    },
  }];
  switch (target) {
    case "page-root": return entries.filter((entry) => entry.node.tag === "main");
    case "conversation-root": return (scene.url === "https://chatgpt.com/"
      || (/\/c\/sha256:[a-f0-9]{64}$/u.test(scene.url) && markerObserved))
      ? entries.filter((entry) => entry.node.tag === "main") : [];
    case "child-conversation-root": return /\/c\/sha256:[a-f0-9]{64}$/u.test(scene.url) && markerObserved
      ? entries.filter((entry) => entry.node.tag === "main") : [];
    case "composer":
    case "composer-editable-leaf":
    case "composer-text-projection": return entries.filter((entry) => attr(entry, "id") === "prompt-textarea");
    case "attachment-region":
    case "attachment-trigger": return entries.filter((entry) => attr(entry, "data-testid") === "composer-plus-btn");
    case "attachment-cards": return virtualAggregate("APPROVED_PRODUCTION_ATTACHMENT_SET", entries.filter((entry) =>
      attr(entry, "role") === "group" && entry.node.machineFacts?.productionAttachmentGroupAncestor === true));
    case "upload-status": return virtualAggregate("UPLOAD_STATUS", entries.filter((entry) =>
      (attr(entry, "role") === "group" && entry.node.machineFacts?.productionAttachmentGroupAncestor === true)
      || entry.node.machineFacts?.attachmentUploadErrorAlert === true));
    case "user-turn": return entries.filter((entry) => attr(entry, "data-message-author-role") === "user"
      && userOwnerMatches(entry));
    case "source-turn":
    case "rich-text-response": return entries.filter((entry) => attr(entry, "data-message-author-role") === "assistant"
      && assistantOwnerMatches(entry));
    case "assistant-turn": {
      if (assistantBound) return candidateContext.imageChild
        ? entries.filter((entry) => /^conversation-turn-[1-9][0-9]*$/u.test(String(attr(entry, "data-testid") ?? ""))
          && entry.node.machineFacts?.userRoleDescendants === 0 && assistantOwnerMatches(entry))
        : entries.filter((entry) => attr(entry, "data-message-author-role") === "assistant"
          && assistantOwnerMatches(entry));
      if (candidateContext.latestTextAssistantChild) {
        const assistants = entries.filter((entry) => attr(entry, "data-message-author-role") === "assistant");
        const latestOrdinal = Math.max(0, ...assistants.map((entry) => Number(String(entry.node.machineFacts?.ownerTurnTestId ?? "").slice("conversation-turn-".length))));
        return assistants.filter((entry) => entry.node.machineFacts?.ownerTurnTestId === `conversation-turn-${latestOrdinal}`);
      }
      if (!candidateContext.imageChild) return entries.filter((entry) => attr(entry, "data-message-author-role") === "assistant");
      const turns = entries.filter((entry) => /^conversation-turn-[1-9][0-9]*$/u.test(String(attr(entry, "data-testid") ?? ""))
        && entry.node.machineFacts?.userRoleDescendants === 0);
      const latestOrdinal = Math.max(0, ...turns.map((entry) => Number(String(attr(entry, "data-testid")).slice("conversation-turn-".length))));
      return turns.filter((entry) => attr(entry, "data-testid") === `conversation-turn-${latestOrdinal}`);
    }
    case "semantic-text-projection":
    case "response-text-region": {
      const responses = entries.filter((entry) => attr(entry, "data-message-author-role") === "assistant"
        && entry.node.subtreeTextProjection?.length > 0);
      if (assistantBound) return responses.filter(assistantOwnerMatches);
      if (!candidateContext.latestTextAssistantChild) return responses;
      const latestOrdinal = Math.max(0, ...responses.map((entry) => Number(String(entry.node.machineFacts?.ownerTurnTestId ?? "").slice("conversation-turn-".length))));
      return responses.filter((entry) => entry.node.machineFacts?.ownerTurnTestId === `conversation-turn-${latestOrdinal}`);
    }
    case "assistant-generation-boundary":
    case "generation-indicator":
    case "image-generation-indicator": return entries.filter((entry) => attr(entry, "data-testid") === "stop-button"
      || String(attr(entry, "aria-label") ?? "").includes("停止"));
    case "semantic-media-node":
    case "original-content-control": return entries.filter((entry) => entry.node.tag === "img"
      && entry.node.media?.complete === true && entry.node.media?.naturalWidth > 100
      && entry.node.media?.altLength > 0 && assistantOwnerMatches(entry));
    case "execution-profile-trigger":
    case "execution-profile-close-control": return entries.filter((entry) => entry.node.tag === "button"
      && attr(entry, "aria-expanded") !== undefined && attr(entry, "data-testid") !== "composer-plus-btn"
      && attr(entry, "aria-label") === undefined
      && entry.node.machineFacts?.composerFormAncestor === true);
    case "execution-profile-panel":
    case "model-selector-panel": return menus;
    case "model-selector-trigger": return entries.filter((entry) => attr(entry, "aria-label") === "选择模型");
    case "model-option": return entries.filter((entry) => attr(entry, "role") === "menuitemradio"
      && subtreeTextOf(entry.node) === candidateContext.authorizedModelId);
    case "selected-model-indicator": return entries.filter((entry) => attr(entry, "role") === "menuitemradio"
      && attr(entry, "aria-checked") === "true");
    case "reasoning-control": return entries.filter((entry) => attr(entry, "role") === "menuitem"
      && attr(entry, "aria-label") === "能力");
    case "selected-reasoning-indicator": return entries.filter((entry) => attr(entry, "role") === "slider");
    case "attachment-menu": {
      const uploadEntries = exactText("从电脑上传");
      if (uploadEntries.length !== 1 || uploadEntries[0].node.machineFacts?.activeAttachmentPopoverAncestor !== true) return [];
      return virtualAggregate("ACTIVE_ATTACHMENT_POPOVER", uploadEntries);
    }
    case "upload-entry": return exactText("从电脑上传");
    case "file-input": return entries.filter((entry) => entry.node.tag === "input" && attr(entry, "type") === "file"
      && attr(entry, "id") === "upload-files");
    case "submit-control": return entries.filter((entry) => attr(entry, "data-testid") === "send-button");
    default: return [];
  }
}

function targetEvidence(target, scene, candidateContext) {
  const raw = candidateEntries(target, scene, candidateContext);
  const eligibility = {
    hiddenAllowed: target === "file-input",
    ariaHiddenAllowed: target === "selected-reasoning-indicator",
  };
  const qualified = raw.filter((entry) => eligible(entry, eligibility));
  const targetRecord = (entry, observed) => ({
    observed,
    identityHash: nodeIdentity(scene, entry.nodeIndex, entry.node),
    nodeIndex: entry.nodeIndex,
    sourceSceneId: scene.sceneId,
    sourceSceneSignature: scene.stateSignature,
    tag: entry.node.tag,
    ...(typeof entry.node.machineFacts?.ownerTurnTestId === "string"
      ? { ownerTurnIdHash: sha256(entry.node.machineFacts.ownerTurnTestId) } : {}),
    attributes: attributesOf(entry.node),
    textProjection: ["semantic-text-projection", "response-text-region"].includes(target)
      ? safeSubtreeProjection(entry.node) : safeTextProjection(entry.node),
    ...(observed ? {} : { diagnosticDom: {
      normalizedStructure: entry.node.sanitizedDomTree,
      sanitizedOuterHtml: entry.node.sanitizedOuterHtml,
    } }),
  });
  if (qualified.length !== 1) return {
    target, rawCount: raw.length, qualifiedCount: qualified.length, selected: null,
    diagnostic: raw.length > 0 ? { entry: raw[0], record: targetRecord(raw[0], false) } : null,
  };
  const entry = qualified[0];
  return {
    target, rawCount: raw.length, qualifiedCount: qualified.length, selected: entry,
    diagnostic: null, record: targetRecord(entry, true),
  };
}

function specimenSignature(scene, targetRecords) {
  return sha256(JSON.stringify(stable({ sceneSignature: scene.stateSignature, url: scene.url, targets: targetRecords })));
}

function capturedPhase(scene) {
  if (scene.transitionReceipt?.outcome === "DISPATCH_RETURNED") return "POST_ACTION";
  if (scene.decisionReceipt?.kind === "ACTION_REQUIRED") return "PRE_ACTION";
  if (scene.decisionReceipt?.kind === "ALREADY_SATISFIED") return "ALREADY_SATISFIED";
  return "OBSERVATION_ONLY";
}

function terminalPair(scene, capture) {
  const receipt = scene.transitionReceipt;
  if (receipt?.outcome !== "DISPATCH_RETURNED") return null;
  const pre = capture.sceneManifest.find((entry) => entry.sceneId === receipt.preSceneId);
  if (!pre || pre.stateSignature !== receipt.preSceneSignature
    || pre.decisionReceipt?.kind !== "ACTION_REQUIRED"
    || pre.decisionReceipt.actionId !== receipt.actionId
    || pre.decisionReceipt.operation !== receipt.operation
    || !Number.isFinite(Date.parse(receipt.issuedAt))
    || !Number.isFinite(Date.parse(receipt.completedAt))
    || typeof receipt.postconditionPassed !== "boolean"
    || Date.parse(receipt.issuedAt) < Date.parse(pre.capturedAt)
    || Date.parse(receipt.completedAt) < Date.parse(receipt.issuedAt)
    || Date.parse(scene.capturedAt) < Date.parse(receipt.completedAt)) {
    fail("SCENE_TRANSITION_RECEIPT_INVALID", scene.sceneId);
  }
  if (receipt.tabTransition && (receipt.tabTransition.sourceTabIdentityHash !== pre.activeTabIdentityHash
    || receipt.tabTransition.successorTabIdentityHash !== scene.activeTabIdentityHash)) {
    fail("SCENE_TAB_TRANSITION_INVALID", scene.sceneId);
  }
  return { pre, receipt };
}

function transitionChain(child, scene, observationId, capture) {
  if (child.contract.profile === "DOM_OBSERVATION") return {
    preObservationId: observationId,
    typedCommand: { kind: "NOT_APPLICABLE" },
    terminalReceipt: { kind: "NOT_APPLICABLE" },
    postObservationId: observationId,
    directPostcondition: { passed: true, sourceSceneId: scene.sceneId },
  };
  if (scene.transitionReceipt?.outcome === "DISPATCH_RETURNED") {
    const pair = terminalPair(scene, capture);
    return {
    preObservationId: `${child.childCapabilityId}:${pair.receipt.preSceneId}:live`,
    typedCommand: { kind: "CAPTURED_BROWSER_COMMAND", actionId: pair.receipt.actionId, operation: pair.receipt.operation, issuedAt: pair.receipt.issuedAt },
    terminalReceipt: { kind: "CAPTURED_DISPATCH_RETURN", actionId: pair.receipt.actionId, operation: pair.receipt.operation,
      completedAt: pair.receipt.completedAt, preSceneSignature: pair.receipt.preSceneSignature },
    postObservationId: observationId,
    directPostcondition: { passed: pair.receipt.postconditionPassed, sourceSceneId: scene.sceneId,
      sourceSceneSignature: scene.stateSignature },
    };
  }
  if (scene.decisionReceipt?.kind === "ACTION_REQUIRED") {
    const terminalScene = capture.sceneManifest.find((entry) =>
      entry.transitionReceipt?.outcome === "DISPATCH_RETURNED"
      && entry.transitionReceipt?.preSceneId === scene.sceneId
      && entry.transitionReceipt?.actionId === scene.decisionReceipt.actionId);
    if (terminalScene) {
      const pair = terminalPair(terminalScene, capture);
      return {
      preObservationId: observationId,
      typedCommand: { kind: "CAPTURED_BROWSER_COMMAND", actionId: scene.decisionReceipt.actionId,
        operation: scene.decisionReceipt.operation, issuedAt: terminalScene.transitionReceipt.issuedAt },
      terminalReceipt: { kind: "CAPTURED_DISPATCH_RETURN", actionId: terminalScene.transitionReceipt.actionId,
        operation: terminalScene.transitionReceipt.operation,
        completedAt: terminalScene.transitionReceipt.completedAt, preSceneSignature: scene.stateSignature },
      postObservationId: `${child.childCapabilityId}:${terminalScene.sceneId}:live`,
      directPostcondition: { passed: terminalScene.transitionReceipt.postconditionPassed,
        sourceSceneId: terminalScene.sceneId,
        sourceSceneSignature: terminalScene.stateSignature },
      };
    }
  }
  if (scene.decisionReceipt?.kind === "ALREADY_SATISFIED") return {
    preObservationId: observationId,
    typedCommand: { kind: "ZERO_ACTION", reason: "ALREADY_SATISFIED" },
    terminalReceipt: { kind: "COHERENT_READBACK", sceneSignature: scene.stateSignature },
    postObservationId: observationId,
    directPostcondition: { passed: true, sourceSceneId: scene.sceneId, sourceSceneSignature: scene.stateSignature },
  };
  return {
    preObservationId: observationId,
    typedCommand: { kind: "EVIDENCE_MISSING" },
    terminalReceipt: { kind: "EVIDENCE_MISSING" },
    postObservationId: observationId,
    directPostcondition: { passed: false, sourceSceneId: scene.sceneId },
  };
}

function makeLiveSpecimen({ child, requirement, stateId, scene, capture, mapping, traceEntry = null }) {
  const requiredTargets = requirement.liveStateTargets[stateId];
  const candidateContext = {
    authorizedModelId: mapping.authorizedInputs?.["authorized-model-id"]?.values?.[0] ?? "",
    imageChild: ["checkpoint_gpt_generated_image", "wait_for_stable_gpt_image"].includes(child.childCapabilityId),
    latestTextAssistantChild: ["checkpoint_gpt_text_response", "wait_for_stable_gpt_text"].includes(child.childCapabilityId),
    expectedPageInputRoles: traceEntry?.inputBinding?.roleHashes ?? {},
  };
  const targetResults = requiredTargets.map((target) => targetEvidence(target, scene, candidateContext));
  const failures = targetResults.filter((entry) => !entry.selected)
    .map((entry) => `target-not-unique:${entry.target}:raw=${entry.rawCount}:qualified=${entry.qualifiedCount}`);
  const primaryResult = targetResults.find((entry) => entry.selected || entry.diagnostic);
  if (!primaryResult) return { specimen: null, failures };
  const targetRecords = Object.fromEntries(targetResults.map((entry) => [entry.target,
    entry.record ?? entry.diagnostic?.record ?? { observed: false, failure: "TARGET_NOT_FOUND" }]));
  const primary = primaryResult.selected ?? primaryResult.diagnostic.entry;
  const observationId = `${child.childCapabilityId}:${scene.sceneId}:live`;
  const rect = primary.node.rect ?? { x: 0, y: 0, width: 0, height: 0 };
  const chain = transitionChain(child, scene, observationId, capture);
  const specimen = {
    stateId,
    evidenceKind: "LIVE_PAGE",
    capturedAt: scene.capturedAt,
    observationId,
    sourceSceneId: scene.sceneId,
    sourceSceneSignature: scene.stateSignature,
    documentIdentityHash: scene.documentIdentityHash,
    targetIdentityHash: nodeIdentity(scene, primary.nodeIndex, primary.node),
    revision: scene.observationRevisionHash,
    stateFacts: { stateId, observed: true, sourceSceneId: scene.sceneId,
      capturePhase: capturedPhase(scene), inputRefs: requirement.requiredInputRefs,
      authorizedInputVariantHashes: Object.values(child.evidenceDemand.authorizedInputRequirements ?? {})
        .flatMap((entry) => entry.variants.map((variant) => variant.valueHash)).sort(),
      ...(scene.pageFacts ?? {}) },
    stateSignature: specimenSignature(scene, targetRecords),
    core: {
      normalizedStructure: primary.node.sanitizedDomTree,
      sanitizedOuterHtml: primary.node.sanitizedOuterHtml,
      attributes: attributesOf(primary.node),
      computedStyle: primary.node.style ?? { display: "unknown", visibility: "unknown", opacity: "unknown" },
      connected: primary.node.connected ?? true,
      layout: { ...rect, inViewport: rect.width > 0 && rect.height > 0 && rect.x < capture.environment.viewport.width && rect.y < capture.environment.viewport.height },
      scope: { candidateCount: primaryResult.rawCount, qualifiedCount: primaryResult.qualifiedCount,
        selectedReason: failures.length === 0 ? `exact-live-scene:${scene.sceneId}`
          : `diagnostic-failed-scene:${scene.sceneId}` },
      candidates: candidateEntries(primaryResult.target, scene, candidateContext).map((entry) => ({
        qualified: eligible(entry, {
          hiddenAllowed: primaryResult.target === "file-input",
          ariaHiddenAllowed: primaryResult.target === "selected-reasoning-indicator",
        }),
        rejectionReasons: eligible(entry, {
          hiddenAllowed: primaryResult.target === "file-input",
          ariaHiddenAllowed: primaryResult.target === "selected-reasoning-indicator",
        }) ? [] : ["INELIGIBLE"],
        identityHash: nodeIdentity(scene, entry.nodeIndex, entry.node),
      })),
      targets: targetRecords,
      textProjection: safeTextProjection(primary.node),
      actionQualification: { qualified: failures.length === 0 && chain.directPostcondition.passed,
        sourceSceneId: scene.sceneId, sourceSceneSignature: scene.stateSignature },
    },
    related: {
      ancestors: primary.node.ancestors ?? [],
      siblings: primary.node.siblings ?? [],
      linkedNodes: Object.entries(targetRecords).filter(([, entry]) => entry.identityHash)
        .map(([relation, entry]) => ({ relation, identityHash: entry.identityHash, attributes: entry.attributes })),
      beforeAfterDiff: { sourceSceneId: scene.sceneId, sceneSignature: scene.stateSignature, transitionReceipt: scene.transitionReceipt ?? null },
      contractReference: { childCapabilityId: child.childCapabilityId, contractVersion: child.contractVersion, contract: child.contract },
      sourceReferences: child.webImplementationReferences.map(({ path }) => ({ path })),
      authorityEvidence: child.evidenceDemand.sourceBinding.authority,
      postconditions: { positive: failures.length === 0 && chain.directPostcondition.passed,
        negative: failures.length > 0 || !chain.directPostcondition.passed },
      browserCommand: chain.typedCommand,
      walProjection: child.contract.profile === "DOM_OBSERVATION" ? { kind: "NOT_APPLICABLE" } : chain.terminalReceipt,
      transitionChain: chain,
    },
    peripheral: {
      pageKind: "chatgpt",
      sanitizedUrlIdentity: scene.url,
      locale: capture.environment.locale,
      viewport: capture.environment.viewport,
      theme: capture.environment.theme,
      chromeVersion: capture.browser.version,
      providerBuildMarker: capture.environment.providerBuildMarker,
      uiVariant: { roles: [...new Set(scene.nodes.map((node) => attributesOf(node).role).filter((value) => typeof value === "string"))].sort() },
      pageState: { sceneSignature: scene.stateSignature },
      runId: capture.runId,
    },
  };
  return { specimen, failures: [
    ...failures,
    ...stateAssertionFailures(specimen, requirement.stateAssertions?.[stateId] ?? []),
    ...transitionEvidenceFailures(specimen, capture.sceneManifest, child.contract),
  ] };
}

function derivedMutation(stateId, live) {
  const rules = [
    [/aria-hidden/u, "SET_ARIA_HIDDEN"], [/hidden/u, "SET_HIDDEN"], [/inert/u, "SET_INERT"],
    [/disabled/u, "SET_DISABLED"], [/no-layout/u, "REMOVE_LAYOUT"],
    [/duplicate|ambiguous|multiple/u, "DUPLICATE_CANDIDATE"],
    [/missing|unavailable|empty/u, "REMOVE_REQUIRED_FACT"],
    [/stale|revision/u, "CHANGE_REVISION"],
    [/document|wrong-conversation|wrong-turn|wrong-panel|wrong-menu|wrong-destination/u, "CHANGE_DOCUMENT_OR_OWNER"],
    [/mismatch|different|partially|truncated|thumbnail/u, "CHANGE_EXPECTED_VALUE"],
    [/remains|still|never|did-not|not-stable|unknown/u, "REMOVE_TERMINAL_POSTCONDITION"],
  ];
  const kind = rules.find(([pattern]) => pattern.test(stateId))?.[1] ?? "CHANGE_SEMANTIC_FACT";
  const path = kind === "CHANGE_REVISION" ? "revision"
    : kind === "CHANGE_DOCUMENT_OR_OWNER" ? "documentIdentityHash"
      : kind === "REMOVE_TERMINAL_POSTCONDITION" ? "related.transitionChain.directPostcondition.passed"
        : ["DUPLICATE_CANDIDATE", "REMOVE_REQUIRED_FACT"].includes(kind) ? "core.scope.qualifiedCount"
          : kind === "REMOVE_LAYOUT" ? "core.layout.width" : "core.connected";
  const current = valueAtPath(live, path);
  return { kind, changes: [{ path, fromHash: sha256(JSON.stringify(stable(current))),
    toValueHash: sha256(JSON.stringify(stable({ derivedFailure: stateId }))) }] };
}

function makeDerivedSpecimen(live, stateId) {
  return {
    stateId,
    evidenceKind: "DERIVED_FIXTURE",
    capturedAt: live.capturedAt,
    derivedFromObservationId: live.observationId,
    mutation: derivedMutation(stateId, live),
    expectedFailureCode: `DERIVED_${stateId.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}`,
  };
}

function assertSceneBindings(scene, runId, captureEpoch, qaTabIdentityHash) {
  if (scene.stateSignature !== sceneContentSignature(scene)) fail("SCENE_SIGNATURE_INVALID", scene.sceneId);
  if (!/^sha256:[a-f0-9]{64}$/u.test(scene.activeTabIdentityHash ?? "")
    || !/^sha256:[a-f0-9]{64}$/u.test(scene.documentIdentityHash ?? "")
    || scene.observationRevisionHash !== sha256(JSON.stringify({
      documentIdentityHash: scene.documentIdentityHash,
      url: scene.url,
      nodes: scene.nodes,
      pageFacts: scene.pageFacts,
    }))) fail("SCENE_DOCUMENT_REVISION_INVALID", scene.sceneId);
  const binding = scene.binding;
  if (binding?.runId !== runId || binding?.captureEpoch !== captureEpoch
    || binding?.qaTabIdentityHash !== qaTabIdentityHash) {
    fail("SCENE_BINDING_STALE", scene.sceneId);
  }
}

function assertRecaptureTrigger(trigger) {
  if (!trigger || !["PAGE_EVIDENCE_CONFLICT_CONFIRMED", "HUMAN_REQUESTED_RECAPTURE"].includes(trigger.kind)) {
    fail("RECAPTURE_FORBIDDEN");
  }
  if (trigger.kind === "HUMAN_REQUESTED_RECAPTURE") {
    if (!Array.isArray(trigger.scope) || trigger.scope.length === 0
      || !trigger.scope.every((entry) => typeof entry === "string" && entry.length > 0)
      || !Number.isFinite(Date.parse(trigger.requestedAt))) fail("RECAPTURE_TRIGGER_INVALID");
    return;
  }
  const evidence = trigger.sameIncidentEvidence;
  if (!Array.isArray(trigger.affectedSceneIds) || trigger.affectedSceneIds.length === 0
    || !evidence || ![evidence.codeEvidenceHash, evidence.logEvidenceHash, evidence.pageReadbackHash]
      .every((value) => /^sha256:[a-f0-9]{64}$/u.test(value ?? ""))) fail("RECAPTURE_TRIGGER_INVALID");
}

function exactObjectKeys(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function mappedStateIdsForCall(requirement, callMapping, traceEntry) {
  const traceEntryId = traceEntry.traceEntryId;
  const mappedStateIds = Object.keys(callMapping?.states ?? {});
  if (mappedStateIds.length === 0) fail("PRODUCT_CALL_MAPPING_SCHEMA_INVALID", traceEntryId);
  const allowedStateIds = [...requirement.requiredLiveStates, ...(requirement.optionalLiveStates ?? [])];
  for (const stateId of mappedStateIds) {
    if (!allowedStateIds.includes(stateId)) {
      fail("PRODUCT_CALL_STATE_OUT_OF_SCOPE", `${traceEntryId}:${stateId}`);
    }
  }
  return requiredLiveStatesForTrace(requirement, traceEntry);
}

function terminalProofValid(source) {
  const proof = source?.terminalBranchProof;
  if (source?.flowStatus === "PARTIAL") return proof === null;
  if (source?.terminalBranch !== "production-failure") {
    return exactObjectKeys(proof, ["kind", "receiptHash", "resultPayloadHash", "resultObjectReceiptHash",
      "resultPayloadOutboxHash"])
      && proof.kind === "DURABLE_COMPLETION_RECEIPT"
      && [proof.receiptHash, proof.resultPayloadHash, proof.resultObjectReceiptHash,
        proof.resultPayloadOutboxHash].every((value) => /^sha256:[a-f0-9]{64}$/u.test(value ?? ""));
  }
  const failedTraceIds = new Set((source.actualTrace ?? [])
    .filter((entry) => entry?.resultStatus === "failed").map((entry) => entry.traceEntryId));
  return exactObjectKeys(proof, ["kind", "failedTraceEntryId", "terminalSource", "durableFailureReceiptHash",
    "durableFailureCodeHash", "traceFailureCodeHash", "codeRelation", "childCorrelation", "evidenceCorrelation"])
    && proof.kind === "DURABLE_FAILURE_AND_TRACE_TERMINAL"
    && failedTraceIds.has(proof.failedTraceEntryId)
    && ["ATTEMPT_FAILURE_ROW", "CURRENT_TASK_ROW"].includes(proof.terminalSource)
    && /^sha256:[a-f0-9]{64}$/u.test(proof.durableFailureReceiptHash ?? "")
    && (proof.durableFailureCodeHash === null || /^sha256:[a-f0-9]{64}$/u.test(proof.durableFailureCodeHash ?? ""))
    && (proof.traceFailureCodeHash === null || /^sha256:[a-f0-9]{64}$/u.test(proof.traceFailureCodeHash ?? ""))
    && ["EXACT", "PRODUCT_FAILURE_WRAPS_TRACE_FAILURE"].includes(proof.codeRelation)
    && ["MATCHED", "NOT_DECLARED"].includes(proof.childCorrelation)
    && ["MATCHED", "NOT_DECLARED"].includes(proof.evidenceCorrelation);
}

function sceneManifestEntry(scene) {
  const decisionReceipt = scene.decisionReceipt?.kind === "ALREADY_SATISFIED"
    ? { kind: scene.decisionReceipt.kind }
    : scene.decisionReceipt?.kind === "ACTION_REQUIRED"
      ? { kind: scene.decisionReceipt.kind, actionId: scene.decisionReceipt.actionId,
        operation: scene.decisionReceipt.operation }
      : null;
  const entry = stable({
    sceneId: scene.sceneId,
    capturedAt: scene.capturedAt,
    stateSignature: scene.stateSignature,
    activeTabIdentityHash: scene.activeTabIdentityHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash,
    binding: scene.binding,
    transitionReceipt: scene.transitionReceipt ?? null,
    decisionReceipt,
  });
  return { ...entry, envelopeHash: sha256(JSON.stringify(entry)) };
}

function authorizedInputs(mapping, inventory, matrix, selectedIds) {
  const ids = [...new Set(matrix.children.filter((child) => selectedIds.includes(child.childCapabilityId))
    .flatMap((child) => child.requiredInputRefs)
    .filter((id) => id.startsWith("authorized-")))].sort();
  return Object.fromEntries(ids.map((id) => {
    const descriptor = mapping.authorizedInputs?.[id];
    if (!descriptor || !Array.isArray(descriptor.values) || descriptor.values.length === 0
      || descriptor.values.some((value) => typeof value !== "string" || value.length === 0)) {
      fail("AUTHORIZED_INPUT_SOURCE_REQUIRED", id);
    }
    const expected = inventory.children.filter((child) => child.collectionRequirements?.requiredInputRefs.includes(id))
      .map((child) => child.evidenceDemand.authorizedInputRequirements?.[id])
      .filter(Boolean);
    if (expected.length === 0 || expected.some((entry) => JSON.stringify(entry) !== JSON.stringify(expected[0]))) {
      fail("AUTHORIZED_INPUT_DEMAND_INCONSISTENT", id);
    }
    const actualHashes = [...new Set(descriptor.values.map(sha256))].sort();
    const expectedHashes = expected[0].variants.map((variant) => variant.valueHash).sort();
    if (JSON.stringify(actualHashes) !== JSON.stringify(expectedHashes)) {
      fail("AUTHORIZED_INPUT_VARIANT_SET_MISMATCH", id);
    }
    return [id, { kind: "AUTHORIZED_FACT_SET", sourceKind: "PRODUCT_PROFILE",
      variants: expected[0].variants, setHash: expected[0].setHash }];
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const required of ["inventory", "matrix", "scenes", "mapping", "production-source", "browser-meta", "output"]) {
    if (!args[required]) fail("ARGUMENT_REQUIRED", `--${required}`);
  }
  const [inventory, matrix, scenes, mapping, rawProductionSource, browserMeta] = await Promise.all([
    readJson(args.inventory), readJson(args.matrix), readJson(args.scenes), readJson(args.mapping),
    readJson(args["production-source"]), readJson(args["browser-meta"]),
  ]);
  const productionSource = rawProductionSource;
  if (productionSource.schemaVersion !== PRODUCTION_SOURCE_SCHEMA
    || productionSource.sourceKind !== "PRODUCTION_RUNTIME_DURABLE_TASK"
    || productionSource.synthetic !== false
    || !/^sha256:[a-f0-9]{64}$/u.test(productionSource.sourceSnapshotId ?? "")
    || !/^sha256:[a-f0-9]{64}$/u.test(productionSource.flowContractDigest ?? "")
    || !["OBSERVED_COMPLETE_PATH", "PARTIAL"].includes(productionSource.flowStatus)
    || (productionSource.flowStatus === "OBSERVED_COMPLETE_PATH"
      ? typeof productionSource.terminalBranch !== "string" || productionSource.terminalBranch.length === 0
      : productionSource.terminalBranch !== null)
    || !terminalProofValid(productionSource)
    || !Array.isArray(productionSource.flowGaps)
    || !Array.isArray(productionSource.materials)
    || !Array.isArray(productionSource.actualTrace) || productionSource.actualTrace.length === 0
    || productionSource.materialSetHash !== sha256(JSON.stringify(stable(productionSource.materials)))
    || productionSource.sourceSnapshotId !== sha256(JSON.stringify(stable({
      taskBinding: productionSource.taskBinding, materials: productionSource.materials,
    })))
    || productionSource.traceDigest !== sha256(JSON.stringify(stable(productionSource.actualTrace)))
    || productionSource.actualTrace.some((entry) => !/^sha256:[a-f0-9]{64}$/u.test(entry.traceEntryId ?? "")
      || !pageInputBindingValid(entry.inputBinding))
    || new Set(productionSource.actualTrace.map((entry) => entry.traceEntryId)).size
      !== productionSource.actualTrace.length) {
    fail("PRODUCTION_SOURCE_INVALID");
  }
  if (!Array.isArray(scenes) || scenes.length === 0) fail("SCENE_SET_EMPTY");
  const sceneIds = scenes.map((scene) => scene.sceneId);
  if (new Set(sceneIds).size !== sceneIds.length) fail("SCENE_ID_DUPLICATE");
  const scenesById = Object.fromEntries(scenes.map((scene) => [scene.sceneId, scene]));
  const runId = `${productionSource.jobId}:${productionSource.attemptId}`;
  const captureEpoch = browserMeta.captureEpoch;
  const recaptureTrigger = browserMeta.recaptureTrigger;
  const pageIds = inventory.denominator.pageOperationChildIds;
  const actualPageIds = [...new Set(productionSource.actualTrace.map((entry) => entry.childId)
    .filter((childId) => pageIds.includes(childId)))];
  if (actualPageIds.length === 0) fail("PRODUCT_TRACE_PAGE_CALL_EMPTY");
  const matrixById = Object.fromEntries(matrix.children.map((entry) => [entry.childCapabilityId, entry]));
  const selectedIds = typeof args.child === "string" && args.child !== "all"
    ? args.child.split(",").filter(Boolean) : actualPageIds;
  if (new Set(selectedIds).size !== selectedIds.length) fail("CAPTURE_CHILD_DUPLICATE");
  for (const id of selectedIds) if (!actualPageIds.includes(id)) fail("CAPTURE_CHILD_OUT_OF_SCOPE", id);
  if (!mapping.productCalls || typeof mapping.productCalls !== "object" || Array.isArray(mapping.productCalls)) {
    fail("PRODUCT_CALL_MAPPING_REQUIRED");
  }
  if (Object.prototype.hasOwnProperty.call(mapping, "children")) fail("MAPPING_CHILD_SECOND_TRUTH_FORBIDDEN");
  const traceEntryIds = new Set(productionSource.actualTrace.map((entry) => entry.traceEntryId));
  const traceById = Object.fromEntries(productionSource.actualTrace.map((entry) => [entry.traceEntryId, entry]));
  for (const [traceEntryId, callMapping] of Object.entries(mapping.productCalls)) {
    if (!traceEntryIds.has(traceEntryId)) fail("PRODUCT_CALL_MAPPING_OUT_OF_SCOPE", traceEntryId);
    if (!callMapping || typeof callMapping !== "object" || Array.isArray(callMapping)
      || Object.keys(callMapping).some((key) => key !== "states")
      || !callMapping.states || typeof callMapping.states !== "object" || Array.isArray(callMapping.states)
      || Object.values(callMapping.states).some((sceneId) => typeof sceneId !== "string" || sceneId.length === 0)) {
      fail("PRODUCT_CALL_MAPPING_SCHEMA_INVALID", traceEntryId);
    }
    const requirement = matrixById[traceById[traceEntryId].childId];
    if (requirement) mappedStateIdsForCall(requirement, callMapping, traceById[traceEntryId]);
  }
  const mappedSceneIds = new Set(Object.values(mapping.productCalls)
    .flatMap((callMapping) => Object.values(callMapping.states ?? {})));
  const reportSceneIds = new Set(mappedSceneIds);
  for (const sceneId of mappedSceneIds) {
    const preSceneId = scenesById[sceneId]?.transitionReceipt?.preSceneId;
    if (typeof preSceneId === "string") reportSceneIds.add(preSceneId);
  }
  const reportScenes = scenes.filter((scene) => reportSceneIds.has(scene.sceneId));
  if (reportScenes.length !== reportSceneIds.size) fail("PRODUCT_CALL_MAPPED_SCENE_MISSING");
  if (!/^sha256:[a-f0-9]{64}$/u.test(captureEpoch ?? "")) fail("CAPTURE_EPOCH_REQUIRED");
  assertRecaptureTrigger(recaptureTrigger);
  for (const scene of scenes) assertSceneBindings(scene, runId, captureEpoch, browserMeta.browser.qaTabIdentityHash);

  const capture = {
    schemaVersion: CAPTURE_SCHEMA,
    capturedAt: new Date(Math.max(...scenes.map((scene) => Date.parse(scene.capturedAt)))).toISOString(),
    runId,
    captureEpoch,
    recaptureTrigger,
    matrixDigest: inventory.matrixBinding.digest,
    browser: stable({
      family: browserMeta.browser.family,
      version: browserMeta.browser.version,
      controlSkill: browserMeta.browser.controlSkill,
      dedicatedQaTab: browserMeta.browser.dedicatedQaTab,
      qaTabCreatedByRun: browserMeta.browser.qaTabCreatedByRun,
      livePageObserved: browserMeta.browser.livePageObserved,
      productionBrowserIdleEvidence: {
        observed: browserMeta.browser.productionBrowserIdleEvidence?.observed,
      },
      qaTabIdentityHash: browserMeta.browser.qaTabIdentityHash,
    }),
    environment: stable({
      locale: browserMeta.environment.locale,
      viewport: {
        width: browserMeta.environment.viewport?.width,
        height: browserMeta.environment.viewport?.height,
      },
      theme: browserMeta.environment.theme,
      providerBuildMarker: browserMeta.environment.providerBuildMarker,
    }),
    productionSource,
    authorizedInputs: authorizedInputs(mapping, inventory, matrix, selectedIds),
    chainInputs: {},
    sceneManifest: reportScenes.map(sceneManifestEntry),
    children: [],
  };
  const assembly = {};
  for (const child of inventory.children.filter((entry) =>
    entry.pageOperationRequired && selectedIds.includes(entry.childCapabilityId))) {
    const requirement = matrixById[child.childCapabilityId];
    const mappedProductCall = [...productionSource.actualTrace].reverse().find((entry) =>
      entry.childId === child.childCapabilityId && mapping.productCalls?.[entry.traceEntryId]);
    const childMapping = mappedProductCall
      ? mapping.productCalls[mappedProductCall.traceEntryId]
      : { states: {} };
    const mappedIds = Object.values(childMapping.states ?? {}).filter(Boolean);
    if (new Set(mappedIds).size !== mappedIds.length) fail("CHILD_STATE_SCENE_REUSE_FORBIDDEN", child.childCapabilityId);
    const live = [];
    const skippedStates = {};
    for (const stateId of requirement.requiredLiveStates) {
      const sceneId = childMapping.states?.[stateId];
      const scene = scenesById[sceneId];
      if (!scene) { skippedStates[stateId] = ["scene-not-mapped"]; continue; }
      const built = makeLiveSpecimen({ child, requirement, stateId, scene, capture, mapping,
        traceEntry: mappedProductCall ?? null });
      if (!built.specimen) { skippedStates[stateId] = built.failures; continue; }
      live.push(built.specimen);
    }
    const derivedStates = [...matrix.commonRequiredDerivedStates, ...requirement.childSpecificDerivedStates];
    const derived = live.length > 0 ? derivedStates.map((stateId) => makeDerivedSpecimen(live[0], stateId)) : [];
    const byState = Object.fromEntries(live.map((specimen) => [specimen.stateId, specimen]));
    const factBindings = child.evidenceDemand.facts.flatMap((fact) => {
      let specimen = live[0];
      let pointers = ["related.contractReference"];
      if (fact.factId.startsWith("target:")) {
        const target = fact.factId.slice("target:".length);
        specimen = live.find((entry) => entry.core.targets[target]);
        pointers = [`core.targets.${target}`];
      } else if (fact.factId.startsWith("live-state:")) {
        specimen = byState[fact.factId.slice("live-state:".length)]; pointers = ["stateFacts.stateId"];
      } else if (fact.factId.startsWith("derived-state:")) pointers = ["related.contractReference"];
      else if (fact.factId.startsWith("input:")) pointers = ["stateFacts.inputRefs"];
      else if (fact.factId.startsWith("authorized-input:")) pointers = ["stateFacts.authorizedInputVariantHashes"];
      else if (fact.factId.startsWith("chain:")) pointers = ["related.transitionChain"];
      else if (fact.factId.startsWith("authority:")) pointers = ["related.authorityEvidence"];
      return specimen ? [{ factId: fact.factId, observationId: specimen.observationId, pointers,
        expectedHash: sha256(JSON.stringify(stable(fact.expected))) }] : [];
    });
    capture.children.push({ childCapabilityId: child.childCapabilityId,
      demandDigest: child.evidenceDemand.digest,
      childCandidateDigest: child.evidenceDemand.childCandidateDigest,
      inputRefs: requirement.requiredInputRefs, factBindings, specimens: [...live, ...derived] });
    assembly[child.childCapabilityId] = { liveStates: live.map((entry) => entry.stateId), skippedStates };
  }

  const childStructurallyComplete = (childId, seen = new Set()) => {
    if (seen.has(childId)) fail("CHAIN_INPUT_CYCLE", childId);
    const nextSeen = new Set(seen).add(childId);
    const source = capture.children.find((child) => child.childCapabilityId === childId);
    const sourceRequirement = matrixById[childId];
    const sourceDemand = inventory.children.find((child) => child.childCapabilityId === childId)?.evidenceDemand;
    if (!source || !sourceRequirement || !sourceDemand) return false;
    const sourceLiveStates = new Set(source.specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE")
      .map((specimen) => specimen.stateId));
    const sourceDerivedStates = new Set(source.specimens.filter((specimen) => specimen.evidenceKind === "DERIVED_FIXTURE")
      .map((specimen) => specimen.stateId));
    const requiredDerivedStates = [...matrix.commonRequiredDerivedStates, ...sourceRequirement.childSpecificDerivedStates];
    const exactFactSet = JSON.stringify([...new Set(source.factBindings.map((entry) => entry.factId))].sort())
      === JSON.stringify(sourceDemand.facts.map((entry) => entry.factId).sort());
    const dependenciesComplete = sourceRequirement.requiredInputRefs.filter((inputId) => inputId.startsWith("chain-"))
      .every((inputId) => childStructurallyComplete(matrix.chainInputSources?.[inputId], nextSeen));
    return sourceRequirement.requiredLiveStates.every((stateId) => sourceLiveStates.has(stateId))
      && requiredDerivedStates.every((stateId) => sourceDerivedStates.has(stateId))
      && exactFactSet && dependenciesComplete;
  };

  for (const [id, sourceChildCapabilityId] of Object.entries(matrix.chainInputSources ?? {})) {
    const source = capture.children.find((child) => child.childCapabilityId === sourceChildCapabilityId);
    const sourceLive = source?.specimens.filter((specimen) => specimen.evidenceKind === "LIVE_PAGE").at(-1);
    const sourceComplete = childStructurallyComplete(sourceChildCapabilityId);
    if (!sourceLive || !sourceComplete) {
      capture.chainInputs[id] = { kind: "MISSING_PRIOR_CHILD_OUTPUT", sourceChildCapabilityId };
      continue;
    }
    const sourceDemand = inventory.children.find((child) => child.childCapabilityId === sourceChildCapabilityId)?.evidenceDemand;
    const evidenceRef = `${sourceChildCapabilityId}:${sourceDemand.childCandidateDigest}:${sourceLive.observationId}:${sourceLive.stateSignature}`;
    capture.chainInputs[id] = { kind: "PRIOR_CHILD_OUTPUT", sourceChildCapabilityId,
      sourceDemandDigest: sourceDemand.digest, sourceChildCandidateDigest: sourceDemand.childCandidateDigest,
      evidenceRef, observationId: sourceLive.observationId, observationSignature: sourceLive.stateSignature,
      sha256: sha256(evidenceRef) };
  }
  const productSceneOwners = new Map();
  const calls = productionSource.actualTrace.map((traceEntry) => {
    const child = inventory.children.find((entry) => entry.childCapabilityId === traceEntry.childId);
    const requirement = matrixById[traceEntry.childId];
    if (!child?.pageOperationRequired || !requirement) return sealedProductCall({
      ...traceEntry, pageOperationRequired: false, pageRequirementSnapshot: null, inputBindingProof: null,
      domEvidence: null, captureComplete: true, gaps: [],
    });
    const callMapping = mapping.productCalls?.[traceEntry.traceEntryId];
    if (!callMapping) {
      const requiredLiveStates = requiredLiveStatesForTrace(requirement, traceEntry);
      const pageEvidenceNotApplicable = pageEvidenceNotApplicableForTrace(traceEntry);
      const pageRequirementSnapshot = captureTimePageRequirementSnapshot(
        requirement, traceEntry, child, capture.matrixDigest,
      );
      const inputBindingProof = derivePageInputBindingProof(
        traceEntry, [], pageRequirementSnapshot.requiredInputRoles,
      );
      return sealedProductCall({ ...traceEntry, pageOperationRequired: true, pageRequirementSnapshot,
        inputBindingProof, domEvidence: pageEvidenceNotApplicable ? { specimens: [] } : null,
        captureComplete: pageEvidenceNotApplicable, gaps: pageEvidenceNotApplicable ? []
          : ["PAGE_EVIDENCE_GAP:product-call-scene-map-missing",
          ...inputBindingProof.checks.filter((entry) => entry.status === "GAP")
            .map((entry) => `PAGE_INPUT_BINDING_GAP:${entry.role}`),
          ...(inputBindingProof.inputHashBound ? [] : ["PAGE_INPUT_BINDING_GAP:inputHash"])] });
    }
    const requiredLiveStates = mappedStateIdsForCall(requirement, callMapping, traceEntry);
    const pageRequirementSnapshot = captureTimePageRequirementSnapshot(
      requirement, traceEntry, child, capture.matrixDigest,
    );
    const specimens = [];
    const gaps = [];
    const mappedSceneIds = Object.values(callMapping.states ?? {}).filter(Boolean);
    if (new Set(mappedSceneIds).size !== mappedSceneIds.length) {
      fail("PRODUCT_CALL_SCENE_REUSE_FORBIDDEN", traceEntry.exactCallIdentityHash);
    }
    for (const sceneId of mappedSceneIds) {
      const owner = productSceneOwners.get(sceneId);
      if (owner && owner !== traceEntry.traceEntryId) {
        fail("PRODUCT_CALL_SCENE_CROSS_CALL_REUSE_FORBIDDEN", `${sceneId}:${owner}:${traceEntry.traceEntryId}`);
      }
      productSceneOwners.set(sceneId, traceEntry.traceEntryId);
    }
    for (const stateId of requiredLiveStates) {
      const scene = scenesById[callMapping.states?.[stateId]];
      if (!scene) { gaps.push(`PAGE_EVIDENCE_GAP:${stateId}:scene-not-mapped`); continue; }
      const built = makeLiveSpecimen({ child, requirement, stateId, scene, capture, mapping, traceEntry });
      if (!built.specimen) gaps.push(...built.failures.map((failure) => `PAGE_EVIDENCE_GAP:${stateId}:${failure}`));
      else {
        specimens.push(built.specimen);
        gaps.push(...built.failures.map((failure) => `PAGE_EVIDENCE_CONFLICT:${failure}`));
      }
    }
    const inputBindingProof = derivePageInputBindingProof(
      traceEntry, specimens, pageRequirementSnapshot.requiredInputRoles,
    );
    gaps.push(...inputBindingProof.checks.filter((entry) => entry.status === "GAP")
      .map((entry) => `PAGE_INPUT_BINDING_GAP:${entry.role}`));
    if (!inputBindingProof.inputHashBound) gaps.push("PAGE_INPUT_BINDING_GAP:inputHash");
    return sealedProductCall({ ...traceEntry, pageOperationRequired: true, pageRequirementSnapshot, inputBindingProof,
      domEvidence: { specimens }, captureComplete: gaps.length === 0, gaps });
  });
  const productGaps = [...productionSource.flowGaps,
    ...calls.flatMap((call) => call.gaps.map((gap) => `${call.productStepId}/${call.actionOrdinal}/${call.childId}:${gap}`))];
  capture.productRun = stable({
    productId: productionSource.productId,
    actionId: productionSource.actionId,
    pluginId: productionSource.pluginId,
    pluginVersion: productionSource.pluginVersion,
    jobIdHash: sha256(productionSource.jobId),
    attemptIdHash: sha256(productionSource.attemptId),
    sourceSnapshotId: productionSource.sourceSnapshotId,
    flowContractDigest: productionSource.flowContractDigest,
    traceDigest: productionSource.traceDigest,
    flowStatus: productionSource.flowStatus,
    flowProjectionStatus: productionSource.flowProjectionStatus ?? null,
    flowProjectionGaps: productionSource.flowProjectionGaps ?? [],
    terminalBranch: productionSource.terminalBranch,
    terminalBranchProof: productionSource.terminalBranchProof,
    calls,
    captureComplete: productionSource.flowStatus === "OBSERVED_COMPLETE_PATH"
      && calls.every((call) => call.captureComplete === true),
    gaps: productGaps,
  });
  await writeJsonAtomic(args.output, capture);
  process.stdout.write(`${JSON.stringify({ output: args.output, runId, product: `${productionSource.productId}/${productionSource.actionId}`,
    productCaptureComplete: capture.productRun.captureComplete, gaps: capture.productRun.gaps, assembly })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
