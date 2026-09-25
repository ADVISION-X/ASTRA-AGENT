import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stateAssertionFailures } from "./trace-page-requirements.mjs";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stable(value[key])])) : value;
const digest = (value) => sha(JSON.stringify(stable(value)));
const HASH = /^sha256:[a-f0-9]{64}$/u;
const CELL_STATUS = new Set(["OBSERVED", "NOT_REACHED", "NOT_APPLICABLE", "CAPTURE_GAP", "CONFLICT"]);
const FIELD_STATUS = new Set(["MATCH", "DRIFT", "UNOBSERVED", "CODE_ONLY", "REVIEW_REQUIRED"]);
const REQUIRED_SOURCE_FILES = ["src/plugins/public-knowledge-article-pipeline/index.ts",
  "src/plugins/public-knowledge-article-pipeline/seo-turn-prompts.ts",
  "src/plugins/public-knowledge-article-pipeline/seo-turn-contract.ts",
  "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts",
  "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts",
  "src/plugins/public-knowledge-article-pipeline/result-contract.ts",
  "src/capabilities/gpt/contract.ts",
  "src/lib/browser/chrome-extension/dom-semantic-text.ts",
  "src/lib/local-runtime/production/website-agent-route-policies.v1.json"];
const die = (code) => { throw new Error(code); };
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const localeCodeFiles = ["src/plugins/localization-production/flow.ts",
  "src/plugins/localization-production/result-contract.ts",
  "src/plugins/localization-production/SKILL.md",
  "src/mediator/product-plugin-catalog.ts", "src/capabilities/gpt/schema.ts",
  "src/lib/local-runtime/production/website-agent-route-policies.v1.json"];
const localeSourceKeys = ["schemaVersion", "sourceRelationship", "websiteObjectBytesRead",
  "routePolicyHash", "sourceCodeHashes", "rootArticleReadback", "entries"];
const localeEntryKeys = ["locale", "jobIdHash", "requestHash", "taskEnvelopeHash",
  "parentJobIdHash", "parentResultHash", "sourceResourceIdHash", "parentReadbackHash",
  "sourceVersionHash", "sourceSha256", "resultRevisionHash", "materials"];
const localeMaterialKeys = ["role", "ordinal", "displayName", "bytes", "sha256",
  "materialIdHash", "ownerScopeHashDigest"];
const localeMaterialRoles = ["source_content", "terminology", "locale_policy", "render_policy"];

/** Public hash-only projection. Never copy a private task or material body into the report. */
export function projectLocalizationSource(raw) {
  if (!raw || !Array.isArray(raw.entries)) die("SEO_LOCALIZATION_SOURCE_INVALID");
  const projected = { schemaVersion: raw.schemaVersion,
    sourceRelationship: raw.sourceRelationship,
    websiteObjectBytesRead: raw.websiteObjectBytesRead,
    routePolicyHash: raw.routePolicyHash,
    sourceCodeHashes: Object.fromEntries(localeCodeFiles.map((path) =>
      [path, raw.sourceCodeHashes?.[path]])),
    rootArticleReadback: Object.fromEntries(["articleIdHash", "sourceVersionHash",
      "articleMarkdownHash", "admissionReceiptHash"].map((key) =>
      [key, raw.rootArticleReadback?.[key]])),
    entries: raw.entries.map((entry) => Object.fromEntries(localeEntryKeys.map((key) =>
      [key, key === "materials" ? entry.materials?.map((material) =>
        Object.fromEntries(localeMaterialKeys.map((field) => [field, material[field]]))) : entry[key]]))) };
  if (!exactKeys(projected, localeSourceKeys) || projected.entries.length !== 5
    || projected.entries.some((entry, index) => !exactKeys(entry, localeEntryKeys)
      || entry.locale !== localeOrder[index] || entry.materials?.length !== 4
      || localeEntryKeys.filter((key) => !["locale", "materials"].includes(key))
        .some((key) => !HASH.test(entry[key] ?? ""))
      || entry.materials.some((material, ordinal) => !exactKeys(material, localeMaterialKeys)
        || material.role !== localeMaterialRoles[ordinal] || material.ordinal !== ordinal
        || material.displayName !== `${localeMaterialRoles[ordinal]}.json`
        || !HASH.test(material.sha256 ?? "") || !HASH.test(material.materialIdHash ?? "")
        || !HASH.test(material.ownerScopeHashDigest ?? "")
        || !Number.isSafeInteger(material.bytes) || material.bytes < 1))
    || !exactKeys(projected.sourceCodeHashes, localeCodeFiles)
    || Object.values(projected.sourceCodeHashes).some((value) => !HASH.test(value ?? ""))
    || !exactKeys(projected.rootArticleReadback, ["articleIdHash", "sourceVersionHash",
      "articleMarkdownHash", "admissionReceiptHash"])
    || !HASH.test(projected.routePolicyHash ?? "")
    || !Object.values(projected.rootArticleReadback).every((value) => HASH.test(value ?? ""))) {
    die("SEO_LOCALIZATION_SOURCE_INVALID");
  }
  return projected;
}

const PROFILE = ["open_gpt_execution_profile", "open_gpt_model_selector_v3",
  "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
  "close_gpt_execution_profile"];
const TEXT = ["write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response"];
export const seoExpectedCalls = Object.freeze([
  ...["prepare_clean_gpt_chat", ...PROFILE, "open_gpt_attachment_control",
    "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set", ...TEXT]
    .map((childCapabilityId) => ({ stepId: "corpus_research", childCapabilityId })),
  ...[...PROFILE, ...TEXT]
    .map((childCapabilityId) => ({ stepId: "article_synthesis", childCapabilityId })),
  ...[...PROFILE, "write_exact_gpt_prompt", "submit_exact_gpt_turn_once",
    "checkpoint_gpt_generated_image"]
    .map((childCapabilityId) => ({ stepId: "article_image_generation", childCapabilityId })),
]);
export const localeOrder = Object.freeze(["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"]);
const localeChildren = Object.freeze([...PROFILE, "open_gpt_attachment_control",
  "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set", ...TEXT]);
const localeExpectedCalls = localeOrder.flatMap((locale) => localeChildren.map((childCapabilityId) =>
  ({ stepId: `article_translation:${locale}`, childCapabilityId })));
const expectedStageSteps = (hasLocales) => ["corpus_research", "article_synthesis",
  "article_image_generation", ...(hasLocales ? localeOrder.map((locale) => `article_translation:${locale}`) : [])];

const terminalStates = {
  prepare_clean_gpt_chat: ["fresh-empty-chat"],
  open_gpt_execution_profile: ["profile-open", "profile-already-open"],
  open_gpt_model_selector_v3: ["model-selector-open", "model-selector-already-open"],
  select_gpt_model_from_start_v3: ["model-selection-postcondition"],
  select_gpt_reasoning_from_start_v3: ["reasoning-selection-postcondition"],
  close_gpt_execution_profile: ["profile-closed", "profile-already-closed"],
  open_gpt_attachment_control: ["attachment-menu-after", "attachment-menu-already-open"],
  attach_approved_gpt_files_once: ["file-set-readback"],
  reconcile_gpt_attachment_set: ["attachment-set-exact"],
  write_exact_gpt_prompt: ["exact-prompt-after", "prompt-already-exact"],
  submit_exact_gpt_turn_once: ["confirmed-submit-effect-readback"],
  checkpoint_gpt_text_response: ["stable-text-checkpoint"],
  checkpoint_gpt_generated_image: ["stable-image-checkpoint"],
};

const stateBranches = {
  prepare_clean_gpt_chat: [["fresh-empty-chat"],
    ["stale-draft-before", "stale-draft-after-clean", "fresh-empty-chat"]],
  open_gpt_execution_profile: [["profile-collapsed-trigger", "profile-open"], ["profile-already-open"]],
  open_gpt_model_selector_v3: [["model-selector-openable", "model-selector-open"],
    ["model-selector-already-open"]],
  select_gpt_model_from_start_v3: [["target-model-actionable-unchecked",
    "model-panel-closed-after-selection", "model-selection-postcondition"]],
  select_gpt_reasoning_from_start_v3: [["reasoning-scale-current-variant",
    "reasoning-target-selected", "reasoning-selection-postcondition"]],
  close_gpt_execution_profile: [["profile-before-close", "profile-closed"],
    ["profile-already-closed"]],
  open_gpt_attachment_control: [["attachment-trigger-before", "attachment-menu-after"],
    ["attachment-menu-already-open"]],
  attach_approved_gpt_files_once: [["upload-leaf-ready", "file-chooser-bound", "file-set-readback"]],
  reconcile_gpt_attachment_set: [["attachment-cards-ready", "attachment-set-exact"]],
  write_exact_gpt_prompt: [["composer-before", "exact-prompt-after"], ["prompt-already-exact"]],
  submit_exact_gpt_turn_once: [["pre-submit-ready", "post-submit-user-turn",
    "confirmed-submit-effect-readback"]],
  checkpoint_gpt_text_response: [["rich-response-outer-html", "semantic-projection-readback",
    "stable-text-checkpoint"]],
  checkpoint_gpt_generated_image: [["stable-image-checkpoint"]],
};

export const freezeSeoFlow = (hasLocales = false) => ({ expectedCalls: [...seoExpectedCalls,
  ...(hasLocales ? localeExpectedCalls : [])].map((entry) => ({ ...entry })),
  terminalStates: structuredClone(terminalStates), stateBranches: structuredClone(stateBranches),
  productSourceHashes: {
    "src/plugins/public-knowledge-article-pipeline/index.ts":
      "sha256:9bd05808883e846c74a599f48f113b8ab78423fd2aac94f7f343b33bddf16c46",
    "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts":
      "sha256:27452a4ab77b520e738b6bf63743b82106953a1b28aaac0282589a4da2d0ccd2",
    "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts":
      "sha256:81206292fcfd0ac80daf48493a3a0c831d61be8bc40fc497e0b48ab96e4104a9",
  } });

export function selectedSeoBranch(call, frozenFlow) {
  const branches = frozenFlow.stateBranches[call.childCapabilityId];
  if (!Array.isArray(branches) || branches.length === 0) return null;
  const mapped = new Set(call.stateIds ?? []);
  const ranked = branches.map((states) => ({ states,
    score: states.filter((stateId) => mapped.has(stateId)).length }));
  const best = Math.max(...ranked.map((entry) => entry.score));
  const matching = ranked.filter((entry) => entry.score === best);
  const shortest = Math.min(...matching.map((entry) => entry.states.length));
  const winners = matching.filter((entry) => entry.states.length === shortest);
  if (best === 0 || winners.length !== 1) return null;
  const chosen = winners[0].states;
  const exclusiveElsewhere = branches.some((branch) => branch.some((stateId) =>
    !chosen.includes(stateId) && mapped.has(stateId)));
  return exclusiveElsewhere ? null : chosen;
}

export function seoFlowGaps(revision) {
  const frozen = revision.frozenFlow ?? freezeSeoFlow();
  const callGaps = frozen.expectedCalls.flatMap(({ stepId, childCapabilityId }) => {
    const call = revision.calls.find((entry) => entry.stepId === stepId
      && entry.childCapabilityId === childCapabilityId);
    if (!call) return [`missing-call:${stepId}/${childCapabilityId}`];
    const branch = selectedSeoBranch(call, frozen);
    if (!branch) return [`ambiguous-branch:${stepId}/${childCapabilityId}`];
    const missing = branch.filter((stateId) => !revision.cells.some((cell) =>
      cell.childCapabilityId === childCapabilityId && cell.stateId === stateId
      && cell.status === "OBSERVED" && cell.observations.some((row) =>
        row.observedCallId === call.observedCallId)));
    const states = frozen.terminalStates[childCapabilityId];
    if (missing.length > 0) return missing.map((stateId) =>
      `missing-branch-state:${stepId}/${childCapabilityId}/${stateId}`);
    if (!states || !states.some((stateId) => revision.cells.some((cell) =>
      cell.childCapabilityId === childCapabilityId && cell.stateId === stateId
      && cell.status === "OBSERVED" && cell.observations.some((row) =>
        row.observedCallId === call.observedCallId)))) {
      return [`missing-terminal-state:${stepId}/${childCapabilityId}`];
    }
    return [];
  });
  return [...callGaps, ...revision.cells.filter((cell) => ["CAPTURE_GAP", "CONFLICT"].includes(cell.status))
    .map((cell) => `cell-${cell.status.toLowerCase()}:${cell.childCapabilityId}/${cell.stateId}`)];
}

function sealedBody(revision) {
  const { contentHash, evidenceRevisionId, ...body } = revision;
  return body;
}

export function sealSeoRevision(body) {
  const identity = digest(body);
  return { ...body, evidenceRevisionId: identity, contentHash: identity };
}

export function fixedFieldValues({ captureRunId, observedCallId, childCapabilityId,
  stateId, scene, specimen }) {
  return {
    captureRunId, observedCallId, childCapabilityId, stateId,
    capturedAt: scene.capturedAt,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash,
    sanitizedUrl: scene.url,
    candidateCount: specimen.core.scope.candidateCount,
    candidates: specimen.core.candidates,
    sanitizedOuterHtml: specimen.core.sanitizedOuterHtml,
    attributes: specimen.core.attributes,
    relatedNodes: { ancestors: specimen.related.ancestors,
      siblings: specimen.related.siblings, linkedNodes: specimen.related.linkedNodes },
    visibilityAndLayout: { connected: specimen.core.connected,
      style: specimen.core.computedStyle, layout: specimen.core.layout },
    stateFacts: specimen.stateFacts,
    inputRoleHashes: { exactComposerHash: scene.pageFacts.exactComposerHash ?? null,
      exactUserPromptHashes: scene.pageFacts.exactUserPromptHashes ?? [],
      attachmentLabelHashes: scene.pageFacts.attachmentLabelHashes ?? [],
      visibleModelTextHashes: scene.pageFacts.visibleModelTextHashes ?? [],
      reasoningScaleFacts: scene.pageFacts.reasoningScaleFacts ?? [],
      currentConversationUrlHash: scene.pageFacts.currentConversationUrlHash ?? null,
      turnMarkerHashes: scene.pageFacts.turnMarkerHashes ?? [],
      assistantTurnIdHashes: scene.pageFacts.assistantTurnIdHashes ?? [],
      userTurnBindings: scene.pageFacts.userTurnBindings ?? [],
      conversationTurnBindings: scene.pageFacts.conversationTurnBindings ?? [],
      assistantSemanticTextHashes: scene.pageFacts.assistantSemanticTextHashes ?? [] },
    decisionReceipt: scene.decisionReceipt,
    transitionReceipt: scene.transitionReceipt,
    directPostcondition: specimen.related.transitionChain.directPostcondition,
  };
}

export function validateSeoRevision(revision) {
  const hasLocales = revision?.localizationSource !== undefined;
  const localeSource = revision?.localizationSource;
  if (hasLocales && (localeSource?.schemaVersion !== "gpt-page-localization-pinned-sources.v1"
    || localeSource.sourceRelationship !== "different-article-from-current-seo-qa-turn"
    || localeSource.websiteObjectBytesRead !== true
    || !Array.isArray(localeSource.entries) || localeSource.entries.length !== 5
    || localeSource.entries.some((entry, index) => entry.locale !== localeOrder[index]
      || !HASH.test(entry.jobIdHash ?? "") || !HASH.test(entry.sourceResourceIdHash ?? "")
      || !HASH.test(entry.sourceSha256 ?? "") || entry.materials?.length !== 4)
    || !Object.keys(localeSource.sourceCodeHashes ?? {}).includes("src/plugins/localization-production/flow.ts"))) {
    die("SEO_REVISION_LOCALIZATION_SOURCE_INVALID");
  }
  if (hasLocales && JSON.stringify(localeSource) !== JSON.stringify(projectLocalizationSource(localeSource))) {
    die("SEO_REVISION_LOCALIZATION_SOURCE_NOT_PUBLIC_PROJECTION");
  }
  if (revision?.schemaVersion !== "gpt-page-seo-capture-revision.v1"
    || typeof revision.captureRunId !== "string" || !revision.captureRunId
    || revision.source?.sourceKind !== "LIVE_SEO_CAPTURE_SESSION_INPUT"
    || revision.source.productId !== "public_knowledge_article_pipeline"
    || revision.source.actionId !== "produce_article"
    || !HASH.test(revision.source.jobIdHash ?? "")
    || !HASH.test(revision.source.requestHash ?? "")
    || !HASH.test(revision.source.taskEnvelopeHash ?? "")
    || !HASH.test(revision.source.archiveHash ?? "")
    || !Number.isSafeInteger(revision.source.archiveBytes)
    || revision.source.archiveBytes < 1
    || !Array.isArray(revision.source.archiveEntries)
    || revision.source.archiveEntries.length < 4
    || revision.source.archiveEntries.some((entry) => !HASH.test(entry.pathHash ?? "")
      || !HASH.test(entry.sha256 ?? "") || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1)
    || JSON.stringify(Object.keys(revision.source.sourceHashes ?? {}).sort())
      !== JSON.stringify([...REQUIRED_SOURCE_FILES].sort())
    || REQUIRED_SOURCE_FILES.some((path) => !HASH.test(revision.source.sourceHashes[path] ?? ""))
    || typeof revision.source.executionProfile?.startModelDisplayName !== "string"
    || !revision.source.executionProfile.startModelDisplayName
    || !Number.isSafeInteger(revision.source.executionProfile.requestedReasoningValue)
    || !HASH.test(revision.matrixDigest ?? "")
    || !HASH.test(revision.planDigest ?? "")
    || !HASH.test(revision.flowDigest ?? "") || !revision.frozenFlow
    || !Array.isArray(revision.frozenPlan) || revision.frozenPlan.length === 0
    || !Array.isArray(revision.calls) || !Array.isArray(revision.scenes)
    || !Array.isArray(revision.cells) || !Array.isArray(revision.stageReceipts)
    || !Array.isArray(revision.flowGaps)
    || !["image-complete", "translation-complete", "research-decline", "qa-stopped", "qa-failure", "unknown-effect"].includes(revision.terminalBranch)
    || !["CAPTURE_COMPLETE", "CAPTURE_PARTIAL"].includes(revision.captureStatus)
    || !Number.isFinite(Date.parse(revision.capturedAt ?? ""))) die("SEO_REVISION_SHAPE_INVALID");
  if (digest(revision.frozenPlan) !== revision.planDigest) die("SEO_REVISION_PLAN_HASH_INVALID");
  if (digest(revision.frozenFlow) !== revision.flowDigest
    || (hasLocales && JSON.stringify(revision.frozenFlow.expectedCalls)
      !== JSON.stringify(freezeSeoFlow(true).expectedCalls))
    || !Array.isArray(revision.frozenFlow.expectedCalls)
    || revision.frozenFlow.expectedCalls.length === 0
    || !revision.frozenFlow.terminalStates || !revision.frozenFlow.stateBranches
    || !revision.frozenFlow.productSourceHashes
    || Object.entries(revision.frozenFlow.productSourceHashes).some(([path, hash]) =>
      !HASH.test(hash) || revision.source.sourceHashes[path] !== hash)
    || new Set(revision.frozenFlow.expectedCalls.map((entry) =>
      `${entry.stepId}/${entry.childCapabilityId}`)).size !== revision.frozenFlow.expectedCalls.length
    || revision.frozenFlow.expectedCalls.some((entry) => !revision.frozenPlan.some((child) =>
      child.childCapabilityId === entry.childCapabilityId)
      || !Array.isArray(revision.frozenFlow.terminalStates[entry.childCapabilityId])
      || !Array.isArray(revision.frozenFlow.stateBranches[entry.childCapabilityId])
      || revision.frozenFlow.stateBranches[entry.childCapabilityId].some((branch) =>
        !Array.isArray(branch) || branch.length === 0 || branch.some((stateId) =>
          !revision.frozenPlan.find((child) => child.childCapabilityId === entry.childCapabilityId)
            ?.stateIds.includes(stateId))))) {
    die("SEO_REVISION_FLOW_PLAN_INVALID");
  }
  const ids = revision.frozenPlan.map((child) => child.childCapabilityId);
  if (new Set(ids).size !== ids.length) die("SEO_REVISION_PLAN_DUPLICATE_CHILD");
  const planned = revision.frozenPlan.flatMap((child) => child.stateIds.map((stateId) =>
    `${child.childCapabilityId}/${stateId}`));
  const cells = revision.cells.map((cell) => `${cell.childCapabilityId}/${cell.stateId}`);
  if (new Set(cells).size !== cells.length || JSON.stringify([...planned].sort()) !== JSON.stringify([...cells].sort())) {
    die("SEO_REVISION_CELL_DENOMINATOR_INVALID");
  }
  const callIds = revision.calls.map((call) => call.observedCallId);
  const callRoutes = revision.calls.map((call) => `${call.stepId}/${call.childCapabilityId}`);
  const sceneIds = revision.scenes.map((scene) => scene.sceneId);
  if (new Set(callIds).size !== callIds.length || new Set(callRoutes).size !== callRoutes.length
    || new Set(sceneIds).size !== sceneIds.length) {
    die("SEO_REVISION_DUPLICATE_IDENTITY");
  }
  const callsById = new Map(revision.calls.map((call) => [call.observedCallId, call]));
  const scenesById = new Map(revision.scenes.map((scene) => [scene.sceneId, scene]));
  const expectedCallRoutes = new Set(revision.frozenFlow.expectedCalls.map((entry) =>
    `${entry.stepId}/${entry.childCapabilityId}`));
  for (const call of revision.calls) {
    if (!HASH.test(call.observedCallId ?? "") || !ids.includes(call.childCapabilityId)
      || !expectedCallRoutes.has(`${call.stepId}/${call.childCapabilityId}`)
      || !HASH.test(call.promptHash ?? "") || !HASH.test(call.turnMarkerHash ?? "")
      || !expectedStageSteps(hasLocales).includes(call.stepId)
      || !Array.isArray(call.sceneIds) || call.sceneIds.length === 0
      || !Array.isArray(call.stateIds) || call.stateIds.length === 0
      || new Set(call.stateIds).size !== call.stateIds.length
      || call.stateIds.some((stateId) => !revision.frozenPlan.find((entry) =>
        entry.childCapabilityId === call.childCapabilityId)?.stateIds.includes(stateId))
      || call.sceneIds.some((id) => !scenesById.has(id))) die("SEO_REVISION_CALL_INVALID");
    const origin = call.identityOrigin ?? (() => {
      const scene = scenesById.get(call.sceneIds[0]);
      return scene && { sceneId: scene.sceneId,
        stateSignature: scene.stateSignature, capturedAt: scene.capturedAt };
    })();
    if ((hasLocales || call.identityOrigin) && (!origin?.sceneId || !HASH.test(origin.stateSignature ?? "")
      || !Number.isFinite(Date.parse(origin.capturedAt ?? ""))
      || call.observedCallId !== digest({ captureRunId: revision.captureRunId,
        stepId: call.stepId, childCapabilityId: call.childCapabilityId,
        sceneId: origin.sceneId, signature: origin.stateSignature,
        capturedAt: origin.capturedAt }))) die("SEO_REVISION_CALL_IDENTITY_INVALID");
    if (call.stepId.startsWith("article_translation:")) {
      const locale = call.stepId.slice("article_translation:".length);
      const source = localeSource.entries.find((entry) => entry.locale === locale);
      if (!source || call.productStepId !== "article_synthesis"
        || call.sourceJobIdHash !== source.jobIdHash
        || call.materialDigest !== digest(source.materials)) die("SEO_REVISION_LOCALE_CALL_SOURCE_INVALID");
    }
  }
  for (const scene of revision.scenes) {
    if (hasLocales && (!exactKeys(scene.observationScope,
      ["schemaVersion", "collectorProfile", "profileProvenance", "nodeCoverage", "assistantSemanticCoverage",
        "previousResponseEmptyHashMeaning", "pageTurnCoverage"])
      || scene.observationScope.schemaVersion !== "gpt-page-scene-observation-scope.v1"
      || !["WIDE_FULL_SEMANTIC_V1", "WIDE_CURRENT_LEGACY_EMPTY_V2",
        "CURRENT_TURN_LEGACY_EMPTY_V3", "CURRENT_TURN_NULL_UNREAD_V4"]
        .includes(scene.observationScope.collectorProfile)
      || scene.observationScope.profileProvenance !== (scene.observationScope.collectorProfile
        === "CURRENT_TURN_NULL_UNREAD_V4" ? "SIGNED_PAGE_FACT" : "RETROSPECTIVE_ASSEMBLY_ANNOTATION")
      || scene.observationScope.nodeCoverage !== "SELECTED_VISIBLE_TARGETS_NOT_FULL_DOCUMENT"
      || scene.observationScope.assistantSemanticCoverage !== "NON_EXHAUSTIVE_CURRENT_MARKER_PROJECTION"
      || scene.observationScope.previousResponseEmptyHashMeaning !== "NOT_PROJECTED_OR_EMPTY"
      || scene.observationScope.pageTurnCoverage !== "CURRENTLY_MOUNTED_TURNS_ONLY")) {
      die("SEO_REVISION_SCENE_SCOPE_MISSING");
    }
    if (hasLocales && scene.observationScope.collectorProfile === "CURRENT_TURN_NULL_UNREAD_V4"
      && (scene.pageFacts?.captureScope?.schemaVersion !== "gpt-page-collector-scope.v1"
        || scene.pageFacts.captureScope.nodeSampling !== "CURRENT_MARKER_VISIBLE_TREE_AND_SHARED_CONTROLS"
        || scene.pageFacts.captureScope.assistantSemanticProjection !== "CURRENT_MARKER_ONLY"
        || scene.pageFacts.captureScope.previousResponseHash !== "NULL_WHEN_NOT_PROJECTED")) {
      die("SEO_REVISION_COLLECTOR_SCOPE_FACT_MISMATCH");
    }
    if (!HASH.test(scene.stateSignature ?? "") || !HASH.test(scene.documentIdentityHash ?? "")
      || !HASH.test(scene.observationRevisionHash ?? "")
      || scene.nodes?.some((node) => typeof node.connected !== "boolean")
      || scene.binding?.runId !== revision.captureRunId
      || scene.binding?.sourceInputHash !== digest(revision.source)
      || /\/c\/(?!sha256:)/u.test(scene.url ?? "")) die("SEO_REVISION_SCENE_INVALID");
    const revisionHash = sha(JSON.stringify({ documentIdentityHash: scene.documentIdentityHash,
      url: scene.url, nodes: scene.nodes, pageFacts: scene.pageFacts }));
    const signature = sha(JSON.stringify({ url: scene.url,
      activeTabIdentityHash: scene.activeTabIdentityHash,
      documentIdentityHash: scene.documentIdentityHash,
      observationRevisionHash: scene.observationRevisionHash,
      nodeCount: scene.nodeCount, nodes: scene.nodes, pageFacts: scene.pageFacts,
      binding: scene.binding, decisionReceipt: scene.decisionReceipt,
      transitionReceipt: scene.transitionReceipt }));
    if (scene.observationRevisionHash !== revisionHash || scene.stateSignature !== signature
      || scene.nodeCount !== scene.nodes?.length) die("SEO_REVISION_SCENE_SIGNATURE_INVALID");
  }
  for (const cell of revision.cells) {
    if (!CELL_STATUS.has(cell.status) || typeof cell.reason !== "string"
      || !Array.isArray(cell.observations)) die("SEO_REVISION_CELL_INVALID");
    const cellPlan = revision.frozenPlan.find((entry) => entry.childCapabilityId === cell.childCapabilityId);
    const childWasCalled = revision.calls.some((call) => call.childCapabilityId === cell.childCapabilityId);
    const applicable = revision.calls.filter((call) => call.childCapabilityId === cell.childCapabilityId)
      .some((call) => {
        const branch = selectedSeoBranch(call, revision.frozenFlow);
        return branch ? branch.includes(cell.stateId) : cellPlan.requiredLiveStates.includes(cell.stateId);
      });
    if (cell.status === "NOT_REACHED" && applicable
      || cell.status === "NOT_APPLICABLE" && (!childWasCalled || applicable)
      || cell.status === "CAPTURE_GAP" && !applicable && cellPlan.requiredLiveStates.includes(cell.stateId)) {
      die("SEO_REVISION_STATE_APPLICABILITY_INVALID");
    }
    if (cell.status === "OBSERVED" || cell.status === "CONFLICT") {
      if (cell.observations.length === 0) die("SEO_REVISION_OBSERVATION_EMPTY");
      for (const observation of cell.observations) {
        const call = callsById.get(observation.observedCallId);
        const scene = scenesById.get(observation.sceneId);
        if (!call || !scene || call.childCapabilityId !== cell.childCapabilityId
          || !call.sceneIds.includes(observation.sceneId)
          || observation.specimen?.sourceSceneId !== observation.sceneId
          || observation.specimen?.sourceSceneSignature !== scene.stateSignature
          || observation.specimen?.documentIdentityHash !== scene.documentIdentityHash
          || observation.specimen?.revision !== scene.observationRevisionHash) {
          die("SEO_REVISION_CELL_SCENE_MISMATCH");
        }
        const plan = revision.frozenPlan.find((entry) => entry.childCapabilityId === cell.childCapabilityId);
        const expected = fixedFieldValues({ captureRunId: revision.captureRunId,
          observedCallId: observation.observedCallId, childCapabilityId: cell.childCapabilityId,
          stateId: cell.stateId, scene, specimen: observation.specimen });
        if (JSON.stringify(Object.keys(observation.fieldValues ?? {}).sort())
          !== JSON.stringify([...plan.fixedCaptureFields].sort())
          || JSON.stringify(stable(observation.fieldValues)) !== JSON.stringify(stable(expected))) {
          die("SEO_REVISION_FIXED_FIELD_VALUES_INVALID");
        }
        const failed = stateAssertionFailures(observation.specimen,
          plan.stateAssertions?.[cell.stateId] ?? []).length > 0
          || observation.specimen?.related?.transitionChain?.directPostcondition?.passed !== true
          || observation.specimen?.core?.actionQualification?.qualified !== true;
        if (cell.status === "OBSERVED" && failed) die("SEO_REVISION_FALSE_OBSERVED");
      }
    } else if (cell.observations.length !== 0) {
      die("SEO_REVISION_UNOBSERVED_CELL_HAS_FACTS");
    }
  }
  const sceneOwners = new Map();
  for (const call of revision.calls) for (const sceneId of call.sceneIds) {
    if (sceneOwners.has(sceneId)) die("SEO_REVISION_SCENE_REUSED");
    sceneOwners.set(sceneId, call.observedCallId);
  }
  if (sceneOwners.size !== revision.scenes.length) die("SEO_REVISION_UNOWNED_SCENE");
  for (const receipt of revision.stageReceipts) {
    const call = callsById.get(receipt.observedCallId);
    const scene = scenesById.get(receipt.sceneId);
    if (!call || !scene || call.stepId !== receipt.stepId
      || !call.sceneIds.includes(receipt.sceneId) || !HASH.test(receipt.promptHash ?? "")
      || call.promptHash !== receipt.promptHash
      || receipt.documentIdentityHash !== scene.documentIdentityHash
      || receipt.observationRevisionHash !== scene.observationRevisionHash
      || !scene.pageFacts?.exactUserPromptHashes?.includes(receipt.promptHash)) {
      die("SEO_REVISION_STAGE_RECEIPT_INVALID");
    }
    if (hasLocales) {
      const expectedChild = receipt.stepId === "article_image_generation"
        ? "checkpoint_gpt_generated_image" : "checkpoint_gpt_text_response";
      if (call.childCapabilityId !== expectedChild || !call.sceneIds.includes(receipt.sceneId)) {
        die("SEO_REVISION_STAGE_CHECKPOINT_MISMATCH");
      }
      const users = scene.pageFacts?.userTurnBindings?.filter((entry) =>
        entry.promptHash === receipt.promptHash
        && entry.turnMarkerHashes?.includes(call.turnMarkerHash) && entry.userTurnIdHash) ?? [];
      const assistants = scene.pageFacts?.conversationTurnBindings?.filter((entry) =>
        entry.precedingPromptHash === receipt.promptHash
        && entry.turnMarkerHashes?.includes(call.turnMarkerHash)
        && entry.assistantTurnIdHash === receipt.assistantTurnIdHash
        && (receipt.responseHash === undefined || entry.responseHash === receipt.responseHash)) ?? [];
      if (users.length !== 1 || assistants.length !== 1) {
        die("SEO_REVISION_STAGE_TURN_BINDING_INVALID");
      }
    }
    if (receipt.stepId.startsWith("article_translation:")) {
      const locale = receipt.stepId.slice("article_translation:".length);
      const source = localeSource?.entries?.find((entry) => entry.locale === locale);
      if (!source || receipt.locale !== locale || receipt.sourceJobIdHash !== source.jobIdHash
        || receipt.sourceResourceIdHash !== source.sourceResourceIdHash
        || receipt.sourceSha256 !== source.sourceSha256
        || receipt.materialDigest !== digest(source.materials)
        || !HASH.test(receipt.parsedResultHash ?? "")
        || receipt.turnMarkerHash !== call.turnMarkerHash
        || receipt.conversationUrlHash !== scene.pageFacts?.currentConversationUrlHash) {
        die("SEO_REVISION_LOCALE_RECEIPT_SOURCE_INVALID");
      }
    }
    if (receipt.stepId === "article_image_generation") {
      if (!scene.nodes.some((node) => node.media?.sourceHash === receipt.imageSourceHash
        && node.media?.ownerTurnIdHash === receipt.assistantTurnIdHash && node.media?.complete === true)
        || !scene.pageFacts.conversationTurnBindings?.some((binding) =>
          binding.precedingPromptHash === receipt.promptHash
          && binding.assistantTurnIdHash === receipt.assistantTurnIdHash)) {
        die("SEO_REVISION_IMAGE_RECEIPT_INVALID");
      }
    } else if (!scene.pageFacts.conversationTurnBindings?.some((binding) =>
      binding.precedingPromptHash === receipt.promptHash
      && binding.responseHash === receipt.responseHash
      && binding.assistantTurnIdHash === receipt.assistantTurnIdHash)) {
      die("SEO_REVISION_TEXT_RECEIPT_INVALID");
    }
  }
  const steps = revision.stageReceipts.map((receipt) => receipt.stepId);
  const expectedSteps = expectedStageSteps(hasLocales);
  const full = steps.length === expectedSteps.length && JSON.stringify(steps) === JSON.stringify(expectedSteps);
  if (steps.length > expectedSteps.length
    || JSON.stringify(steps) !== JSON.stringify(expectedSteps.slice(0, steps.length))) {
    die("SEO_REVISION_STAGE_SEQUENCE_INVALID");
  }
  if (hasLocales) {
    const receiptScenes = revision.stageReceipts.map((receipt) => scenesById.get(receipt.sceneId));
    const times = receiptScenes.map((scene) => Date.parse(scene.capturedAt));
    const userIds = revision.stageReceipts.map((receipt, index) =>
      receiptScenes[index].pageFacts.userTurnBindings.find((entry) =>
        entry.promptHash === receipt.promptHash)?.userTurnIdHash);
    const assistantIds = revision.stageReceipts.map((receipt) => receipt.assistantTurnIdHash);
    const submitTimes = expectedSteps.slice(0, revision.stageReceipts.length).map((stepId) => {
      const submit = revision.calls.find((call) => call.stepId === stepId
        && call.childCapabilityId === "submit_exact_gpt_turn_once");
      const postIndex = submit?.stateIds.indexOf("post-submit-user-turn") ?? -1;
      return postIndex < 0 ? null : Date.parse(scenesById.get(submit.sceneIds[postIndex])?.capturedAt);
    });
    if (new Set(userIds).size !== userIds.length || new Set(assistantIds).size !== assistantIds.length
      || submitTimes.some((time, index) => time !== null && (!Number.isFinite(time)
        || index > 0 && submitTimes[index - 1] !== null && time <= submitTimes[index - 1]))
      || times.some((time, index) => index >= 4 && time <= times[index - 1])
      || revision.calls.some((call) => {
        const stageIndex = expectedSteps.indexOf(call.stepId);
        return stageIndex > 0 && stageIndex < times.length
          && call.stepId.startsWith("article_translation:")
          && call.sceneIds.some((sceneId) => Date.parse(scenesById.get(sceneId).capturedAt)
            <= (stageIndex === 3 ? (submitTimes[stageIndex - 1] ?? 0) : times[stageIndex - 1]));
      })) die("SEO_REVISION_STAGE_CHRONOLOGY_INVALID");
    for (let index = 1; index < revision.stageReceipts.length; index += 1) {
      const nextStep = revision.stageReceipts[index].stepId;
      const previous = revision.stageReceipts[index - 1];
      const firstScene = revision.calls.filter((call) => call.stepId === nextStep)
        .flatMap((call) => call.sceneIds.map((id) => scenesById.get(id)))
        .sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt))[0];
      const priorCall = callsById.get(previous.observedCallId);
      const priorUsers = firstScene?.pageFacts?.userTurnBindings?.filter((entry) =>
        entry.promptHash === previous.promptHash && entry.userTurnIdHash
        && entry.turnMarkerHashes?.includes(priorCall?.turnMarkerHash)) ?? [];
      const priorAssistants = firstScene?.pageFacts?.conversationTurnBindings?.filter((entry) =>
        entry.precedingPromptHash === previous.promptHash
        && entry.assistantTurnIdHash === previous.assistantTurnIdHash
        && entry.turnMarkerHashes?.includes(priorCall?.turnMarkerHash)) ?? [];
      const lastVisibleUser = firstScene?.pageFacts?.userTurnBindings?.at(-1);
      if (priorUsers.length !== 1 || priorAssistants.length !== 1
        || lastVisibleUser?.promptHash !== previous.promptHash) {
        die("SEO_REVISION_ADJACENT_CONVERSATION_LINK_MISSING");
      }
    }
  }
  if (hasLocales && revision.stageReceipts.some((receipt) =>
    scenesById.get(receipt.sceneId)?.pageFacts?.currentConversationUrlHash
      !== scenesById.get(revision.stageReceipts[0]?.sceneId)?.pageFacts?.currentConversationUrlHash)) {
    die("SEO_REVISION_CONVERSATION_CONTINUITY_INVALID");
  }
  if (hasLocales) {
    const canonicalUrlHash = scenesById.get(revision.stageReceipts[0]?.sceneId)
      ?.pageFacts?.currentConversationUrlHash;
    if (!HASH.test(canonicalUrlHash ?? "") || revision.calls.some((call) =>
      call.sceneIds.some((sceneId) => {
        const scene = scenesById.get(sceneId);
        return (call.stepId !== "corpus_research"
          || scene.pageFacts?.currentRouteKind === "CONVERSATION")
          && scene.pageFacts?.currentConversationUrlHash !== canonicalUrlHash;
      }))) die("SEO_REVISION_OWNED_SCENE_URL_DRIFT");
  }
  if (JSON.stringify(revision.flowGaps) !== JSON.stringify(seoFlowGaps(revision))) {
    die("SEO_REVISION_FLOW_GAPS_INVALID");
  }
  const researchDecision = revision.stageReceipts[0]?.decision;
  if (steps.length > 0 && !["proceed", "decline"].includes(researchDecision)) {
    die("SEO_REVISION_RESEARCH_DECISION_INVALID");
  }
  if (steps.length > 1 && researchDecision !== "proceed") die("SEO_REVISION_AFTER_DECLINE_INVALID");
  if (revision.terminalBranch === "translation-complete" && (!hasLocales || !full)) {
    die("SEO_REVISION_FALSE_TRANSLATION_TERMINAL");
  }
  if (revision.terminalBranch === "image-complete" && (hasLocales || !full)) {
    die("SEO_REVISION_FALSE_IMAGE_TERMINAL");
  }
  if (revision.terminalBranch === "research-decline"
    && (steps.length !== 1 || researchDecision !== "decline")) die("SEO_REVISION_DECLINE_INVALID");
  if (["qa-stopped", "qa-failure", "unknown-effect"].includes(revision.terminalBranch)) {
    const terminal = revision.terminalReceipt;
    if (!terminal || !expectedSteps.includes(terminal.stepId)
      || !["yes", "no", "unknown"].includes(terminal.providerEffect)
      || !HASH.test(terminal.reasonHash ?? "")
      || !scenesById.has(terminal.sceneId)
      || !callsById.has(terminal.observedCallId)
      || !callsById.get(terminal.observedCallId).sceneIds.includes(terminal.sceneId)
      || (revision.terminalBranch === "unknown-effect" && terminal.providerEffect !== "unknown")) {
      die("SEO_REVISION_TERMINAL_RECEIPT_INVALID");
    }
  } else if (revision.terminalReceipt !== null) die("SEO_REVISION_UNEXPECTED_TERMINAL_RECEIPT");
  if (revision.captureStatus === "CAPTURE_COMPLETE" && (!full || revision.flowGaps.length !== 0
    || revision.terminalBranch !== (hasLocales ? "translation-complete" : "image-complete")
    || researchDecision !== "proceed")) {
    die("SEO_REVISION_COMPLETENESS_INVALID");
  }
  if (revision.captureStatus === "CAPTURE_PARTIAL" && full && revision.flowGaps.length === 0
    && revision.terminalBranch === (hasLocales ? "translation-complete" : "image-complete")) {
    die("SEO_REVISION_FALSE_PARTIAL");
  }
  if (revision.supersedesRevisionId !== null && (!HASH.test(revision.supersedesRevisionId ?? "")
    || typeof revision.correctionReason !== "string" || !revision.correctionReason.trim())) {
    die("SEO_REVISION_SUPERSESSION_INVALID");
  }
  const bodyHash = digest(sealedBody(revision));
  if (revision.evidenceRevisionId !== bodyHash || revision.contentHash !== bodyHash) {
    die("SEO_REVISION_HASH_INVALID");
  }
  const raw = JSON.stringify(revision);
  if (/\b(?:rawPrompt|promptText|responseText|semanticText|cookie|accessToken|authorizationHeader)\b/iu.test(raw)
    || /\bBearer\s+[A-Za-z0-9._~-]{12,}\b/iu.test(raw)
    || /\bsk-[A-Za-z0-9_-]{12,}\b/iu.test(raw)
    || /\/(?:c|g)\/(?!sha256:)[A-Za-z0-9_-]{8,}/u.test(raw)) die("SEO_REVISION_PLAINTEXT_FORBIDDEN");
  return true;
}

export function validateSeoReportExtension(report) {
  if (report.schemaVersion !== "gpt-page-operation-evidence.v8"
    || !Array.isArray(report.seoCaptureRevisions) || !report.legacyV7
    || !HASH.test(report.legacyV7.reportHash ?? "")
    || !Array.isArray(report.legacyV7.runDigests)
    || !Array.isArray(report.legacyV7.productDigests)) die("SEO_REPORT_EXTENSION_INVALID");
  const oldRuns = report.products.flatMap((product) => product.runs.map((run) => ({
    productKey: product.productKey, sourceSnapshotId: run.sourceSnapshotId, digest: digest(run),
  })));
  const migratedLegacy = report.legacyV7.reportHash !== sha("new-v8-baseline");
  if (migratedLegacy
    && JSON.stringify([...oldRuns].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
    !== JSON.stringify([...report.legacyV7.runDigests].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))) {
    die("SEO_LEGACY_RUN_CHANGED");
  }
  if (migratedLegacy && JSON.stringify(report.products.map((product) => ({
    productKey: product.productKey, digest: digest(product),
  }))) !== JSON.stringify(report.legacyV7.productDigests)) die("SEO_LEGACY_PRODUCT_CHANGED");
  const keys = new Set();
  for (const revision of report.seoCaptureRevisions) {
    validateSeoRevision(revision);
    const key = `${revision.captureRunId}/${revision.evidenceRevisionId}`;
    if (keys.has(key)) die("SEO_REVISION_DUPLICATE");
    keys.add(key);
    if (revision.supersedesRevisionId !== null && !report.seoCaptureRevisions.some((prior) =>
      prior.captureRunId === revision.captureRunId
      && prior.evidenceRevisionId === revision.supersedesRevisionId)) die("SEO_SUPERSEDED_VERSION_MISSING");
  }
  return true;
}

export function migrateV7Envelope(report, originalBytes) {
  if (report.schemaVersion !== "gpt-page-operation-evidence.v7"
    || Object.hasOwn(report, "seoCaptureRevisions") || Object.hasOwn(report, "legacyV7")) {
    die("SEO_V7_MIGRATION_SOURCE_INVALID");
  }
  const migrated = { ...report, schemaVersion: "gpt-page-operation-evidence.v8",
    legacyV7: { reportHash: sha(originalBytes), productDigests: report.products.map((product) => ({
      productKey: product.productKey, digest: digest(product) })), runDigests: report.products.flatMap((product) =>
      product.runs.map((run) => ({ productKey: product.productKey,
        sourceSnapshotId: run.sourceSnapshotId, digest: digest(run) }))) },
    seoCaptureRevisions: [] };
  validateSeoReportExtension(migrated);
  return migrated;
}

export async function withCanonicalReportLock(path, work) {
  const lockPath = `${path}.lock`;
  let handle;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try { handle = await open(lockPath, "wx", 0o600); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
  }
  if (!handle) die("SEO_REPORT_LOCK_BUSY");
  try { return await work(); }
  finally { await handle.close(); await import("node:fs/promises").then(({ unlink }) => unlink(lockPath)); }
}

async function atomicJson(path, value) {
  const temp = `${path}.tmp-${randomUUID()}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, path);
}

export async function migrateCanonicalReport(path, validateLegacy) {
  return withCanonicalReportLock(path, async () => {
    const originalBytes = await readFile(path);
    const report = JSON.parse(originalBytes.toString("utf8"));
    if (report.schemaVersion === "gpt-page-operation-evidence.v8") {
      validateSeoReportExtension(report); return { migrated: false, report };
    }
    await validateLegacy();
    const migrated = migrateV7Envelope(report, originalBytes);
    await atomicJson(path, migrated);
    const readback = JSON.parse(await readFile(path, "utf8"));
    validateSeoReportExtension(readback);
    if (readback.legacyV7.reportHash !== sha(originalBytes)) die("SEO_MIGRATION_READBACK_INVALID");
    return { migrated: true, report: readback };
  });
}

function codeFiles(revision) {
  return [...new Set([...revision.frozenPlan.flatMap((child) => child.codePaths),
    ...Object.keys(revision.localizationSource?.sourceCodeHashes ?? {})])].sort();
}

function pathValue(root, path) {
  return path.split(".").reduce((value, part) => value === null || value === undefined
    ? undefined : value[part], root);
}

function assertionPassed(assertion, specimen) {
  const actual = pathValue(specimen, assertion.path);
  const present = actual !== undefined && actual !== null && actual !== ""
    && (!Array.isArray(actual) || actual.length > 0);
  if (assertion.operator === "equals") return JSON.stringify(actual) === JSON.stringify(assertion.value);
  if (assertion.operator === "present") return present;
  if (assertion.operator === "absent") return !present;
  if (assertion.operator === "sameAs") {
    return JSON.stringify(actual) === JSON.stringify(pathValue(specimen, assertion.valuePath));
  }
  return false;
}

function selectorForTarget(plan, target, code) {
  const name = plan.codeTargetSelectors?.[target];
  const path = plan.codePaths.find((entry) => entry.endsWith("/selectors.ts"));
  if (!name || !path) return null;
  const source = code.get(path);
  const joined = source.lines.join("\n");
  const declaration = new RegExp(`\\bconst\\s+${name}\\s*=\\s*(["'])(.*?)\\1\\s*;`, "su");
  const match = declaration.exec(joined);
  if (!match || /:\s*(?:has|not|is|where)\(/u.test(match[2])) return null;
  const line = joined.slice(0, match.index).split("\n").length;
  const selector = match[2];
  const components = [];
  let current = "", quote = null, bracket = 0;
  for (const character of selector) {
    if ((character === "'" || character === '"') && (quote === null || quote === character)) {
      quote = quote === null ? character : null;
    }
    if (quote === null && character === "[") bracket += 1;
    if (quote === null && character === "]") bracket -= 1;
    if (quote === null && bracket === 0 && /\s/u.test(character)) {
      if (current) components.push(current);
      current = "";
    } else current += character;
  }
  if (current) components.push(current);
  if (components.length === 0 || components.some((part) => /[>+~:]/u.test(part))) return null;
  const attributes = (part) => [...part.matchAll(/\[([a-zA-Z][a-zA-Z0-9:-]*)(?:=(['"])(.*?)\2)?\]/gu)]
    .map((entry) => ({ name: entry[1], expected: entry[3] ?? null }));
  const component = (part) => ({ tag: /^[a-z][a-z0-9-]*/u.exec(part)?.[0] ?? null,
    attributes: attributes(part) });
  const directComponent = component(components.at(-1));
  const direct = directComponent.attributes;
  const scopeComponents = components.slice(0, -1).map(component);
  const scope = scopeComponents.flatMap((part) => part.attributes);
  if (direct.length === 0) return null;
  return { path, line, hash: source.hash, name, direct, directTag: directComponent.tag,
    scope, scopeComponents, selectorHash: sha(selector) };
}

function matchesSelectorPredicates(node, binding) {
  const attrs = node?.attributes ?? {};
  const direct = (binding.directTag === null || node?.tag === binding.directTag)
    && binding.direct.every((predicate) => attributePredicateMatches(
      attrs[predicate.name], predicate.expected) === true);
  const ancestors = node?.ancestors ?? [];
  const scope = binding.scopeComponents.every((part) => ancestors.some((ancestor) =>
    (part.tag === null || ancestor.tag === part.tag)
    && part.attributes.every((predicate) => attributePredicateMatches(
      ancestor.attributes?.[predicate.name], predicate.expected) === true)));
  return direct && scope;
}

function attributePredicateMatches(actual, expected) {
  if (expected === null) return actual !== undefined;
  if (actual === undefined) return false;
  if (typeof actual === "string") return actual === expected;
  if (actual?.kind === "HASH_ONLY" && HASH.test(actual.sha256 ?? "")
    && Number.isSafeInteger(actual.length)) {
    return actual.sha256 === sha(expected) && actual.length === expected.length;
  }
  return null;
}

function comparisonRowsForObservation({ revision, cell, observation, plan, code, scenesById }) {
  if (!observation) return [];
  const rows = [];
  const specimen = observation.specimen;
  const scene = scenesById.get(observation.sceneId);
  const base = { childCapabilityId: cell.childCapabilityId, stateId: cell.stateId,
    observedCallId: observation.observedCallId, sceneId: observation.sceneId };
  const add = (field, expected, actual, verdict, path, line, impact) => rows.push({ ...base,
    field, expectedValueHash: expected === undefined ? null : digest(expected),
    domValueHash: actual === undefined ? null : digest(actual), verdict,
    codePath: path, codeLine: line, codeHash: code.get(path)?.hash ?? null, impact });
  const call = revision.calls.find((entry) => entry.observedCallId === observation.observedCallId);
  for (const [target, record] of Object.entries(specimen.core?.targets ?? {})) {
    const binding = selectorForTarget(plan, target, code);
    if (!binding) continue;
    if (!record.observed) {
      const codeCandidates = scene?.nodes?.filter((node) => matchesSelectorPredicates(node, binding)) ?? [];
      const compared = [...binding.direct, ...binding.scope].every((predicate) =>
        scene?.pageFacts?.capturedAttributeNames?.includes(predicate.name));
      add(`targetResolution.${target}`, binding.selectorHash,
        { collectorObserved: false, codeCandidateCount: codeCandidates.length,
          collectorFailure: record.failure ?? "candidate-ineligible" },
        "REVIEW_REQUIRED",
        binding.path, binding.line,
        compared && codeCandidates.length === 1 ? "one-visible-code-candidate-but-document-cardinality-unproven"
          : "target-unresolved-or-selector-scope-incomplete");
      continue;
    }
    if (binding.directTag !== null) add(`attributes.${target}.tag`, binding.directTag, record.tag,
      record.tag === binding.directTag ? "MATCH" : "DRIFT", binding.path, binding.line,
      record.tag === binding.directTag ? "none" : "code-selector-target-tag-disagrees");
    for (const predicate of binding.direct) {
      const actual = record.attributes?.[predicate.name];
      const captured = scene?.pageFacts?.capturedAttributeNames?.includes(predicate.name) === true;
      const match = captured ? attributePredicateMatches(actual, predicate.expected) : null;
      add(`attributes.${target}.${predicate.name}`, predicate.expected ?? "PRESENT", actual,
        match === null ? "REVIEW_REQUIRED" : match ? "MATCH" : "DRIFT", binding.path, binding.line,
        match === null ? "attribute-projection-not-comparable"
          : match ? "none" : "code-selector-target-attribute-disagrees");
    }
    const node = scene?.nodes?.[record.nodeIndex];
    for (const part of binding.scopeComponents) for (const predicate of part.attributes) {
      const ancestors = (node?.ancestors ?? []).filter((ancestor) =>
        part.tag === null || ancestor.tag === part.tag);
      const sameAncestor = ancestors.some((ancestor) => part.attributes.every((item) =>
        attributePredicateMatches(ancestor.attributes?.[item.name], item.expected) === true));
      const values = ancestors.map((ancestor) => ancestor.attributes?.[predicate.name])
        .filter((value) => value !== undefined);
      const match = predicate.expected === null ? values.length > 0
        : values.some((value) => attributePredicateMatches(value, predicate.expected) === true);
      add(`relatedNodes.scope.${target}.${predicate.name}`, predicate.expected ?? "PRESENT",
        values, values.length === 0 ? "REVIEW_REQUIRED" : match && sameAncestor ? "MATCH" : "DRIFT",
        binding.path, binding.line,
        values.length === 0 ? "code-selector-ancestor-attribute-not-captured"
          : match && sameAncestor ? "none" : "code-selector-scope-disagrees");
    }
    if (record.identityHash === specimen.targetIdentityHash) {
      const codeCount = scene?.nodes?.filter((node) => matchesSelectorPredicates(node, binding)).length;
      add("candidateCount.codeSelectorRaw", codeCount, specimen.core.scope.candidateCount,
        "REVIEW_REQUIRED", binding.path, binding.line,
        "scene-excludes-hidden-or-off-scope-code-candidates-and-ancestor-attributes");
      const observationPath = plan.codePaths.find((path) => path.endsWith("/observation.ts"));
      const source = code.get(observationPath);
      const query = source?.lines.join("\n").match(new RegExp(
        `selector:\\s*${binding.name}\\s*,[\\s\\S]{0,160}?maxMatches:\\s*([0-9]+)`, "u"));
      if (query) {
        const max = Number(query[1]);
        const line = source.lines.join("\n").slice(0, query.index).split("\n").length;
        const actual = specimen.core.scope.candidateCount;
        add("candidateCount.maxMatches", max, actual, "REVIEW_REQUIRED",
          observationPath, line, "maxMatches-limits-returned-matches-not-raw-cardinality");
      }
    }
  }
  const browserPath = "src/lib/browser/chrome-extension/dom-coherent-candidate.ts";
  const browser = code.get(browserPath);
  const uniqueLine = browser?.lines.findIndex((line) => line.includes("if (candidates.length !== 1)")) ?? -1;
  if (uniqueLine >= 0 && specimen.core?.scope) {
    const qualified = specimen.core.scope.qualifiedCount;
    add("candidateCount.uniqueQualified", 1, qualified, "REVIEW_REQUIRED",
      browserPath, uniqueLine + 1, "collector-and-browser-eligibility-projections-not-proven-equal");
  }
  const factsPath = "src/lib/browser/chrome-extension/dom-mechanical-facts.ts";
  const facts = code.get(factsPath);
  const connectedLine = facts?.lines.findIndex((line) => line.includes("element.isConnected === true")) ?? -1;
  if (connectedLine >= 0 && specimen.core?.connected !== undefined) {
    add("visibilityAndLayout.connected", true, specimen.core.connected,
      specimen.core.connected === true ? "MATCH" : "DRIFT", factsPath, connectedLine + 1,
      specimen.core.connected === true ? "none" : "browser-requires-connected-target");
  }
  if (plan.codeTargetSelectors?.["user-turn"] === "GPT_USER_TURN_SELECTOR" && call) {
    const path = "src/capabilities/gpt/children/submit_exact_gpt_turn_once/selectors.ts";
    const source = code.get(path);
    const lineIndex = source?.lines.findIndex((line) => line.includes("GPT_USER_TURN_SELECTOR")) ?? -1;
    const oldSelector = source?.lines.slice(lineIndex + 1, lineIndex + 3).join(" ") ?? "";
    const actualUsers = scene?.pageFacts?.userTurnBindings?.filter((entry) =>
      entry.promptHash === call.promptHash && entry.userTurnIdHash) ?? [];
    const oldDomUnits = scene?.nodes?.filter((node) =>
      /^conversation-turn-[1-9][0-9]*$/u.test(String(node.attributes?.["data-testid"] ?? ""))
      && node.machineFacts?.userRoleDescendants === 1) ?? [];
    if (lineIndex >= 0 && oldSelector.includes("conversation-turn-")
      && oldSelector.includes("data-message-author-role")
      && scene?.pageFacts?.capturedAttributeNames?.includes("data-testid")
      && actualUsers.length === 1 && oldDomUnits.length === 0) {
      add("targetResolution.user-turn", "production-selector-matches-bound-user-turn",
        { actualUserTurnIdHash: actualUsers[0].userTurnIdHash, oldSelectorCandidateCount: 0 },
        "REVIEW_REQUIRED", path, lineIndex + 1,
        "sample-has-no-old-selector-unit-but-full-document-cardinality-unproven");
    }
  }
  const stageReceipt = revision.stageReceipts.find((entry) => entry.stepId === call?.stepId);
  const pageFacts = scene?.pageFacts;
  if (stageReceipt && pageFacts
    && !(cell.childCapabilityId === "write_exact_gpt_prompt" && cell.stateId === "composer-before")
    && ["write_exact_gpt_prompt", "submit_exact_gpt_turn_once",
    "checkpoint_gpt_text_response", "checkpoint_gpt_generated_image"].includes(cell.childCapabilityId)) {
    const userTurns = pageFacts.userTurnBindings?.filter((entry) =>
      entry.promptHash === call.promptHash && entry.userTurnIdHash
      && entry.turnMarkerHashes?.includes(call.turnMarkerHash)) ?? [];
    const hasUser = userTurns.length === 1;
    const hasAssistant = pageFacts.conversationTurnBindings?.filter((entry) =>
      entry.precedingPromptHash === call.promptHash
      && entry.assistantTurnIdHash === stageReceipt.assistantTurnIdHash
      && (stageReceipt.responseHash === undefined || entry.responseHash === stageReceipt.responseHash)).length === 1;
    const actual = cell.childCapabilityId === "write_exact_gpt_prompt"
      ? pageFacts.exactComposerHash === call.promptHash
      : cell.childCapabilityId === "submit_exact_gpt_turn_once"
        ? cell.stateId === "pre-submit-ready"
          ? pageFacts.exactComposerHash === call.promptHash : hasUser
        : hasUser && hasAssistant;
    const imageStep = call?.stepId === "article_image_generation";
    const localeStep = call?.stepId.startsWith("article_translation:") === true;
    const codePath = localeStep ? "src/plugins/localization-production/flow.ts" : imageStep
      ? "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts"
      : "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts";
    const source = code.get(codePath);
    const line = source?.lines.findIndex((text) => text.includes(localeStep
      ? "const promptHash = sha256(prompt)" : imageStep
        ? "const promptHash = textHash(prompt)" : "const promptHash = textHash(input.prompt)")) ?? -1;
    if (line >= 0) add("inputRoleHashes.promptHash", true, actual,
      actual ? "MATCH" : "DRIFT", codePath, line + 1,
      actual ? "none" : "exact-stage-prompt-not-present-in-scene");
  }
  return rows;
}

export async function compareSeoRevision(repo, revision) {
  validateSeoRevision(revision);
  const code = new Map();
  for (const path of codeFiles(revision)) {
    const absolute = resolve(repo, path);
    if (!absolute.startsWith(`${resolve(repo)}/`)) die("SEO_CODE_PATH_OUT_OF_SCOPE");
    const bytes = await readFile(absolute);
    code.set(path, { hash: sha(bytes), lines: bytes.toString("utf8").split("\n") });
  }
  if (revision.localizationSource && Object.entries(revision.localizationSource.sourceCodeHashes)
    .some(([path, expected]) => code.get(path)?.hash !== expected)) {
    die("SEO_COMPARISON_LOCALIZATION_CODE_DRIFT");
  }
  const rows = [];
  const scenesById = new Map(revision.scenes.map((scene) => [scene.sceneId, scene]));
  const userSelectorPath = "src/capabilities/gpt/children/submit_exact_gpt_turn_once/selectors.ts";
  const userSelectorSource = code.get(userSelectorPath);
  const userSelectorLine = userSelectorSource?.lines.findIndex((line) =>
    line.includes("GPT_USER_TURN_SELECTOR")) ?? -1;
  for (const call of revision.calls.filter((item) => item.childCapabilityId === "submit_exact_gpt_turn_once")) {
    const receipt = revision.stageReceipts.find((item) => item.stepId === call.stepId);
    const scene = scenesById.get(receipt?.sceneId);
    if (!scene || userSelectorLine < 0) continue;
    const boundUsers = scene.pageFacts?.userTurnBindings?.filter((item) =>
      item.promptHash === call.promptHash && item.turnMarkerHashes?.includes(call.turnMarkerHash)
      && item.userTurnIdHash) ?? [];
    const oldUnits = scene.nodes.filter((node) =>
      /^conversation-turn-[1-9][0-9]*$/u.test(String(node.attributes?.["data-testid"] ?? ""))
      && node.machineFacts?.userRoleDescendants === 1);
    if (boundUsers.length !== 1) continue;
    rows.push({ childCapabilityId: call.childCapabilityId, stateId: "STAGE_RECEIPT",
      field: "targetResolution.user-turn", observedCallId: call.observedCallId,
      sceneId: scene.sceneId, verdict: "REVIEW_REQUIRED",
      expectedValueHash: digest("production-selector-matches-bound-user-turn"),
      domValueHash: digest({ actualUserTurnIdHash: boundUsers[0].userTurnIdHash,
        oldSelectorCandidateCount: oldUnits.length }), codePath: userSelectorPath,
      codeLine: userSelectorLine + 1, codeHash: userSelectorSource.hash,
      impact: oldUnits.length === 0
        ? "bound-user-turn-exists-sample-has-zero-old-selector-units-full-document-unproven"
        : "old-selector-unit-present-but-document-cardinality-unproven" });
  }
  for (const plan of revision.frozenPlan) for (const target of Object.keys(plan.codeTargetSelectors ?? {})) {
    if (Object.values(plan.liveStateTargets ?? {}).some((targets) => targets.includes(target))) continue;
    const selector = selectorForTarget(plan, target, code);
    if (selector) rows.push({ childCapabilityId: plan.childCapabilityId, stateId: "PLAN",
      field: `codeSelector.${target}`, observedCallId: null, sceneId: null,
      verdict: "CODE_ONLY", expectedValueHash: selector.selectorHash, domValueHash: null,
      codePath: selector.path, codeLine: selector.line, codeHash: selector.hash,
      impact: "code-selector-target-not-in-frozen-state-plan" });
  }
  for (const cell of revision.cells) {
    const plan = revision.frozenPlan.find((entry) => entry.childCapabilityId === cell.childCapabilityId);
    const observations = cell.observations.length ? cell.observations : [null];
    const mechanicalByObservation = new Map(observations.filter(Boolean).map((observation) =>
      [observation, comparisonRowsForObservation({ revision, cell, observation,
        plan, code, scenesById })]));
    for (const observation of observations) for (const field of plan.fixedCaptureFields) {
      const selectorPath = plan.codePaths.find((path) => path.endsWith("/selectors.ts"));
      const handlerPath = plan.codePaths.find((path) => path.endsWith("/handler.ts"));
      const codePath = ["attributes", "candidateCount", "candidates", "sanitizedOuterHtml",
        "relatedNodes", "visibilityAndLayout"].includes(field)
        ? selectorPath ?? plan.codePaths[0] ?? null
        : handlerPath ?? plan.codePaths[0] ?? null;
      const source = codePath === null ? null : code.get(codePath);
      const mechanical = mechanicalByObservation.get(observation) ?? [];
      const fieldRows = mechanical.filter((row) => row.field.startsWith(`${field}.`));
      const mechanicalPath = fieldRows.length > 0
        && fieldRows.every((row) => row.codePath === fieldRows[0].codePath)
        ? fieldRows[0].codePath : null;
      let verdict = ["NOT_REACHED", "NOT_APPLICABLE", "CAPTURE_GAP"].includes(cell.status)
        ? "UNOBSERVED" : fieldRows.some((row) => row.verdict === "DRIFT") ? "DRIFT"
          : "REVIEW_REQUIRED";
      if (!FIELD_STATUS.has(verdict)) die("SEO_COMPARISON_VERDICT_INVALID");
      rows.push({ childCapabilityId: cell.childCapabilityId, stateId: cell.stateId, field,
        observedCallId: observation?.observedCallId ?? null,
        sceneId: observation?.sceneId ?? null, verdict,
        codePath: mechanicalPath ?? codePath,
        codeHash: mechanicalPath ? code.get(mechanicalPath)?.hash ?? null : source?.hash ?? null,
        domValueHash: observation ? digest(observation.fieldValues[field]) : null,
        expectedValueHash: fieldRows.length > 0 ? digest(fieldRows.map((row) => row.expectedValueHash)) : null,
        impact: verdict === "DRIFT" ? "selector-may-miss-or-target-wrong-node"
          : verdict === "UNOBSERVED" ? "required-observation-missing"
            : verdict === "REVIEW_REQUIRED" ? fieldRows.length > 0
              ? [...new Set(fieldRows.filter((row) => row.verdict === "REVIEW_REQUIRED")
                .map((row) => row.impact))].join(",") || "only-subfields-mechanically-comparable"
              : "no-single-semantic-code-consumer" : "none",
        codeLine: fieldRows.length === 1 ? fieldRows[0].codeLine : null });
    }
    for (const observation of observations) rows.push(...(mechanicalByObservation.get(observation) ?? []));
    for (const observation of observations) for (const assertion of plan.stateAssertions?.[cell.stateId] ?? []) {
      const actual = observation ? pathValue(observation.specimen, assertion.path) : undefined;
      const expected = assertion.operator === "sameAs" && observation
        ? pathValue(observation.specimen, assertion.valuePath) : assertion.value;
      const mechanical = mechanicalByObservation.get(observation) ?? [];
      const targetPath = /^core\.targets\.([^.]+)\.attributes\.([^.]+)$/u.exec(assertion.path);
      const primaryPath = /^core\.attributes\.([^.]+)$/u.exec(assertion.path);
      const primaryTarget = observation ? Object.entries(observation.specimen.core?.targets ?? {})
        .find(([, record]) => record.identityHash === observation.specimen.targetIdentityHash)?.[0] : null;
      const mechanicalField = targetPath ? `attributes.${targetPath[1]}.${targetPath[2]}`
        : primaryPath && primaryTarget ? `attributes.${primaryTarget}.${primaryPath[1]}` : null;
      const sameField = mechanical.filter((row) => row.field === mechanicalField
        && assertion.operator === "equals");
      const verdict = !observation ? "UNOBSERVED" : sameField.length === 1
        ? assertionPassed(assertion, observation.specimen) ? sameField[0].verdict : "DRIFT"
        : "REVIEW_REQUIRED";
      rows.push({ childCapabilityId: cell.childCapabilityId, stateId: cell.stateId,
        field: `assertion:${assertion.path}:${assertion.operator}`,
        observedCallId: observation?.observedCallId ?? null, sceneId: observation?.sceneId ?? null,
        verdict, expectedValueHash: expected === undefined ? null : digest(expected),
        domValueHash: actual === undefined ? null : digest(actual),
        codePath: sameField[0]?.codePath ?? null, codeLine: sameField[0]?.codeLine ?? null,
        codeHash: sameField[0]?.codeHash ?? null,
        impact: verdict === "DRIFT" ? "frozen-state-assertion-failed"
          : verdict === "UNOBSERVED" ? "state-not-observed"
            : verdict === "REVIEW_REQUIRED" ? "code-assertion-anchor-ambiguous-or-absent" : "none" });
    }
  }
  const rowsWithPointers = rows.map((row) => {
    if (row.stateId === "STAGE_RECEIPT" && row.field === "targetResolution.user-turn") {
      const scene = scenesById.get(row.sceneId);
      const call = revision.calls.find((item) => item.observedCallId === row.observedCallId);
      const bound = scene?.pageFacts?.userTurnBindings?.filter((item) =>
        item.promptHash === call?.promptHash && item.turnMarkerHashes?.includes(call?.turnMarkerHash)) ?? [];
      const matches = bound.length === 1 ? scene.nodes.flatMap((node, nodeIndex) => {
        const key = node.attributes?.["data-chatgpt-search-unit-key"];
        const testId = node.attributes?.["data-testid"];
        return key?.sha256 === bound[0].userTurnIdHash || testId?.sha256 === bound[0].userTurnIdHash
          ? [{ node, nodeIndex }] : [];
      }) : [];
      if (matches.length === 1) {
        const { node, nodeIndex } = matches[0];
        return { ...row, targetNodeIndex: nodeIndex,
          targetIdentityHash: digest({ sceneSignature: scene.stateSignature, nodeIndex,
            tag: node.tag, attributes: node.attributes, rect: node.rect,
            textProjection: node.textProjection, media: node.media }) };
      }
      return { ...row, targetNodeIndex: null, targetIdentityHash: null };
    }
    const observation = revision.cells.find((cell) => cell.childCapabilityId === row.childCapabilityId
      && cell.stateId === row.stateId)?.observations.find((item) =>
      item.observedCallId === row.observedCallId && item.sceneId === row.sceneId);
    const targets = observation?.specimen?.core?.targets ?? {};
    const targetName = /^attributes\.([^.]+)\./u.exec(row.field)?.[1]
      ?? /^relatedNodes\.scope\.([^.]+)\./u.exec(row.field)?.[1]
      ?? /^targetResolution\.([^.]+)$/u.exec(row.field)?.[1]
      ?? /^assertion:core\.targets\.([^.]+)\./u.exec(row.field)?.[1];
    const target = targetName ? targets[targetName]
      : Object.values(targets).find((item) => item.identityHash === observation?.specimen?.targetIdentityHash);
    return { ...row, targetNodeIndex: Number.isSafeInteger(target?.nodeIndex) ? target.nodeIndex : null,
      targetIdentityHash: HASH.test(target?.identityHash ?? "") ? target.identityHash : null };
  });
  const codeDigest = digest([...code].map(([path, value]) => ({ path, hash: value.hash })));
  const comparisonId = digest({ captureRunId: revision.captureRunId,
    evidenceRevisionId: revision.evidenceRevisionId, codeDigest, rows: rowsWithPointers });
  return { comparisonId, codeDigest, rows: rowsWithPointers };
}

function markdownComparison(revision, result) {
  const rows = result.rows.map((row) => `| ${row.childCapabilityId} | ${row.stateId} | ${row.field} | ${row.verdict} | ${row.observedCallId ?? "—"} / ${row.sceneId ?? "—"} / ${row.targetNodeIndex ?? "—"} / ${row.targetIdentityHash ?? "—"} | ${row.expectedValueHash ?? "—"} | ${row.domValueHash ?? "—"} | ${row.codePath ?? "—"}:${row.codeLine ?? "—"} @ ${row.codeHash ?? "—"} | ${row.impact} |`).join("\n");
  const gaps = revision.cells.filter((cell) => ["CAPTURE_GAP", "CONFLICT"].includes(cell.status))
    .map((cell) => `| ${cell.childCapabilityId} | ${cell.stateId} | ${cell.status} | ${cell.reason} |`).join("\n");
  const flowGaps = revision.flowGaps.map((gap) => `- ${gap}`).join("\n");
  const profiles = [...new Set(revision.scenes.map((scene) =>
    scene.observationScope?.collectorProfile).filter(Boolean))].join(", ");
  return `\n## ${result.comparisonId}\n\n- captureRunId: ${revision.captureRunId}\n- evidenceRevisionId: ${revision.evidenceRevisionId}\n- matrixDigest: ${revision.matrixDigest}\n- planDigest: ${revision.planDigest}\n- codeDigest: ${result.codeDigest}\n- source relationship: ${revision.localizationSource?.sourceRelationship ?? "seo-only"}\n- planned calls: ${revision.frozenFlow.expectedCalls.length}; mapped calls: ${revision.calls.length}; stage receipts: ${revision.stageReceipts.length}; status: ${revision.captureStatus}\n- collector profiles: ${profiles || "legacy-unversioned"}; earlier profiles are retrospective assembly annotations, v4 scope is signed in scene pageFacts\n- scope: selected visible target nodes and currently mounted turn IDs, not full Document; prior assistant empty response hash can mean not projected; no Product/Website admission\n\n### DOM capture gaps\n\n| Child | State | Status | Reason |\n|---|---|---|---|\n${gaps}\n\n### Planned flow gaps\n\n${flowGaps}\n\n### DOM versus code\n\n| Child | State | Field | Result | Call / Scene / Node / Identity | Expected hash | Actual hash | Code | Impact |\n|---|---|---|---|---|---|---|---|---|\n${rows}\n`;
}

export async function appendSeoRevision({ repo, reportPath, comparisonPath, revision }) {
  validateSeoRevision(revision);
  if (revision.localizationSource) {
    const assetsDir = join(repo, ".agents/skills/gpt-page-operation-evidence/assets");
    const currentSource = projectLocalizationSource(JSON.parse(await readFile(join(assetsDir,
      "localization-source-manifest.json"), "utf8")));
    if (digest(currentSource) !== digest(revision.localizationSource)) {
      die("SEO_LOCALIZATION_PINNED_MANIFEST_DRIFT");
    }
    const { loadPinnedLocalizationTurn } = await import("./localization-live-turns.mjs");
    for (const locale of localeOrder) await loadPinnedLocalizationTurn({ repo, assetsDir, locale });
  }
  return withCanonicalReportLock(reportPath, async () => {
    const current = JSON.parse(await readFile(reportPath, "utf8"));
    validateSeoReportExtension(current);
    const sameKey = current.seoCaptureRevisions.find((prior) =>
      prior.captureRunId === revision.captureRunId
      && prior.evidenceRevisionId === revision.evidenceRevisionId);
    if (sameKey && JSON.stringify(sameKey) !== JSON.stringify(revision)) die("SEO_REVISION_KEY_CONFLICT");
    if (revision.supersedesRevisionId !== null && !current.seoCaptureRevisions.some((prior) =>
      prior.captureRunId === revision.captureRunId && prior.evidenceRevisionId === revision.supersedesRevisionId)) {
      die("SEO_SUPERSEDED_VERSION_MISSING");
    }
    for (const call of revision.calls.filter((item) => item.identityOrigin)) {
      const priorBound = current.seoCaptureRevisions.some((prior) => prior.captureRunId === revision.captureRunId
        && prior.calls.some((item) => item.observedCallId === call.observedCallId
          && item.stepId === call.stepId && item.childCapabilityId === call.childCapabilityId
          && item.promptHash === call.promptHash && item.turnMarkerHash === call.turnMarkerHash
          && item.sceneIds[0] === call.identityOrigin.sceneId)
        && prior.scenes.some((scene) => scene.sceneId === call.identityOrigin.sceneId
          && scene.stateSignature === call.identityOrigin.stateSignature
          && scene.capturedAt === call.identityOrigin.capturedAt));
      if (!priorBound) die("SEO_CALL_IDENTITY_LINEAGE_MISSING");
    }
    if (!sameKey) {
      const next = { ...current, seoCaptureRevisions: [...current.seoCaptureRevisions, revision] };
      validateSeoReportExtension(next);
      await atomicJson(reportPath, next);
      const readback = JSON.parse(await readFile(reportPath, "utf8"));
      validateSeoReportExtension(readback);
      if (!readback.seoCaptureRevisions.some((entry) => entry.evidenceRevisionId === revision.evidenceRevisionId
        && entry.captureRunId === revision.captureRunId)) die("SEO_REVISION_READBACK_MISSING");
    }
    const comparison = await compareSeoRevision(repo, revision);
    let existing = "# GPT 页面 DOM 与代码差距报告\n";
    try { existing = await readFile(comparisonPath, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!existing.includes(`## ${comparison.comparisonId}`)) {
      const temp = `${comparisonPath}.tmp-${randomUUID()}`;
      await writeFile(temp, `${existing.trimEnd()}\n${markdownComparison(revision, comparison)}`);
      await rename(temp, comparisonPath);
    }
    const readbackComparison = await readFile(comparisonPath, "utf8");
    if (!readbackComparison.includes(`## ${comparison.comparisonId}`)) die("SEO_COMPARISON_READBACK_MISSING");
    return { evidenceRevisionId: revision.evidenceRevisionId,
      comparisonId: comparison.comparisonId, appended: !sameKey };
  });
}
