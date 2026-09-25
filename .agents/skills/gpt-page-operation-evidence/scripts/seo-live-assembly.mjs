import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { assertSceneBindings, makeLiveSpecimen } from "./assemble-live-capture.mjs";
import { fixedFieldValues, freezeSeoFlow, localeOrder, projectLocalizationSource,
  selectedSeoBranch, sealSeoRevision, seoFlowGaps,
  validateSeoRevision } from "./seo-report-revisions.mjs";
import { assertSeoSourceAdmission } from "./seo-live-source.mjs";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stable(value[key])])) : value;
const digest = (value) => sha(JSON.stringify(stable(value)));
const die = (code) => { throw new Error(code); };

const CODE_SELECTOR_BINDINGS = {
  prepare_clean_gpt_chat: { composer: "GPT_COMPOSER_SELECTOR" },
  open_gpt_execution_profile: { "execution-profile-trigger": "GPT_PROFILE_TRIGGER_SELECTOR" },
  open_gpt_model_selector_v3: { "model-selector-trigger": "GPT_MODEL_SELECTOR_OPENABLE_ENTRY",
    "model-option": "GPT_MODEL_SELECTOR_OPTION" },
  select_gpt_model_from_start_v3: { "model-option": "GPT_MODEL_CHOICE_SELECTOR" },
  select_gpt_reasoning_from_start_v3: { "reasoning-control": "GPT_PROFILE_REASONING_CONTROL_SELECTOR" },
  close_gpt_execution_profile: { composer: "GPT_COMPOSER_SELECTOR",
    "execution-profile-close-control": "GPT_PROFILE_TRIGGER_SELECTOR" },
  open_gpt_attachment_control: { "attachment-trigger": "GPT_ATTACHMENT_CONTROL_SELECTOR" },
  write_exact_gpt_prompt: { composer: "GPT_COMPOSER_SELECTOR" },
  attach_approved_gpt_files_once: { "file-input": "GPT_FILE_INPUT_SELECTOR",
    "attachment-cards": "GPT_ATTACHMENT_ITEM_SELECTOR" },
  reconcile_gpt_attachment_set: { "attachment-cards": "GPT_ATTACHMENT_ITEM_SELECTOR" },
  submit_exact_gpt_turn_once: { composer: "GPT_COMPOSER_SELECTOR",
    "submit-control": "GPT_SEND_SELECTOR", "user-turn": "GPT_USER_TURN_SELECTOR" },
};
const SHARED_CONSUMERS = ["src/lib/browser/chrome-extension/dom-mechanical-facts.ts",
  "src/lib/browser/chrome-extension/dom-coherent-candidate.ts",
  "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts",
  "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts"];

export function observedCallId(captureRunId, stepId, childCapabilityId, firstScene) {
  if (!firstScene?.stateSignature) die("SEO_OBSERVED_CALL_SCENE_REQUIRED");
  return digest({ captureRunId, stepId, childCapabilityId,
    sceneId: firstScene.sceneId, signature: firstScene.stateSignature,
    capturedAt: firstScene.capturedAt });
}

export function freezeSeoPlan(matrix, inventory) {
  if (!Array.isArray(matrix?.fixedCaptureFields) || matrix.fixedCaptureFields.length !== 19) {
    die("SEO_FIXED_FIELD_MATRIX_INVALID");
  }
  return matrix.children.map((requirement) => {
    const child = inventory.children.find((entry) => entry.childCapabilityId === requirement.childCapabilityId);
    if (!child?.pageOperationRequired) die("SEO_CHILD_MATRIX_DRIFT");
    return { childCapabilityId: requirement.childCapabilityId,
      stateIds: [...new Set([...requirement.requiredLiveStates, ...(requirement.optionalLiveStates ?? []),
        ...matrix.commonRequiredDerivedStates, ...requirement.childSpecificDerivedStates])],
      requiredLiveStates: requirement.requiredLiveStates,
      requiredInputRefs: requirement.requiredInputRefs,
      liveStateTargets: requirement.liveStateTargets,
      stateAssertions: requirement.stateAssertions,
      profile: child.contract.profile,
      fixedCaptureFields: matrix.fixedCaptureFields,
      codeTargetSelectors: CODE_SELECTOR_BINDINGS[requirement.childCapabilityId] ?? {},
      codePaths: [...new Set([...child.sourceReferences, ...child.webImplementationReferences]
        .map((entry) => entry.path).filter((path) =>
          /^src\/capabilities\/gpt\/(?:children\/[^/]+\/(?:selectors|observation|handler)\.ts|contract\.ts)$/u.test(path))
        .concat(SHARED_CONSUMERS))].sort() };
  });
}

export async function assembleSeoLiveRevision({ repo, inventory, matrix, scenes, mapping,
  source, sourceAdmission, browserMeta, stageReceipts, localizationSource = null }) {
  assertSeoSourceAdmission(sourceAdmission, source);
  if (source?.sourceKind !== "LIVE_SEO_CAPTURE_SESSION_INPUT"
    || source.productId !== "public_knowledge_article_pipeline" || source.actionId !== "produce_article"
    || !Array.isArray(scenes) || scenes.length === 0
    || !Array.isArray(mapping?.observedCalls) || mapping.observedCalls.length === 0
    || !Array.isArray(stageReceipts)) die("SEO_ASSEMBLY_SOURCE_INVALID");
  if (digest(matrix) !== inventory.matrixBinding?.digest) die("SEO_MATRIX_INVENTORY_DRIFT");
  const currentHashes = Object.fromEntries(await Promise.all(Object.keys(source.sourceHashes ?? {})
    .map(async (path) => [path, sha(await readFile(new URL(`../../../../${path}`, import.meta.url)))])));
  if (JSON.stringify(currentHashes) !== JSON.stringify(source.sourceHashes)) die("SEO_PRODUCT_SOURCE_DRIFT");
  if (localizationSource !== null) {
    localizationSource = projectLocalizationSource(localizationSource);
    if (localizationSource.schemaVersion !== "gpt-page-localization-pinned-sources.v1"
      || localizationSource.entries?.length !== 5
      || localizationSource.entries.some((entry, index) => entry.locale !== localeOrder[index])) {
      die("SEO_LOCALIZATION_SOURCE_INVALID");
    }
    for (const [path, expected] of Object.entries(localizationSource.sourceCodeHashes ?? {})) {
      if (sha(await readFile(new URL(`../../../../${path}`, import.meta.url))) !== expected) {
        die(`SEO_LOCALIZATION_CODE_DRIFT:${path}`);
      }
    }
  }
  const captureRunId = mapping.captureRunId;
  const captureEpoch = mapping.captureEpoch;
  if (!captureRunId || !/^sha256:[a-f0-9]{64}$/u.test(captureEpoch ?? "")
    || browserMeta.browser?.dedicatedQaTab !== true || browserMeta.browser?.qaTabCreatedByRun !== true) {
    die("SEO_QA_SESSION_BINDING_INVALID");
  }
  const sceneById = new Map(scenes.map((scene) => [scene.sceneId, scene]));
  if (sceneById.size !== scenes.length) die("SEO_SCENE_DUPLICATE");
  if (scenes.some((scene) => scene.nodes?.some((node) => typeof node.connected !== "boolean"))) {
    die("SEO_SCENE_CONNECTED_FACT_MISSING");
  }
  for (const scene of scenes) assertSceneBindings(scene, captureRunId, captureEpoch,
    browserMeta.browser.qaTabIdentityHash);
  if (scenes.some((scene) => scene.binding.sourceInputHash !== digest(source))) {
    die("SEO_SCENE_SOURCE_BINDING_INVALID");
  }
  const plan = freezeSeoPlan(matrix, inventory);
  const capture = { sceneManifest: scenes, environment: browserMeta.environment,
    browser: browserMeta.browser, runId: captureRunId };
  const calls = [];
  const sceneOwners = new Set();
  const observations = new Map();
  const sceneProfileNames = new Set(["WIDE_FULL_SEMANTIC_V1",
    "WIDE_CURRENT_LEGACY_EMPTY_V2", "CURRENT_TURN_LEGACY_EMPTY_V3",
    "CURRENT_TURN_NULL_UNREAD_V4"]);
  for (const mapped of mapping.observedCalls) {
    const requirement = matrix.children.find((entry) => entry.childCapabilityId === mapped.childCapabilityId);
    const child = inventory.children.find((entry) => entry.childCapabilityId === mapped.childCapabilityId);
    const locale = mapped.stepId?.startsWith("article_translation:")
      ? mapped.stepId.slice("article_translation:".length) : null;
    const localeSegment = locale === null ? null
      : localizationSource?.entries?.find((entry) => entry.locale === locale);
    if (!requirement || !child || (locale === null
      ? !["corpus_research", "article_synthesis", "article_image_generation"].includes(mapped.stepId)
      : !localeSegment || !localeOrder.includes(locale)
        || mapped.productStepId !== "article_synthesis"
        || mapped.sourceJobIdHash !== localeSegment.jobIdHash
        || mapped.materialDigest !== digest(localeSegment.materials))
      || !mapped.states || typeof mapped.states !== "object"
      || !/^sha256:[a-f0-9]{64}$/u.test(mapped.promptHash ?? "")
      || !/^sha256:[a-f0-9]{64}$/u.test(mapped.turnMarkerHash ?? "")) die("SEO_CALL_ROUTE_INVALID");
    const stageReceipt = stageReceipts.find((entry) => entry.stepId === mapped.stepId);
    if (stageReceipt && stageReceipt.promptHash !== mapped.promptHash) die("SEO_CALL_PROMPT_RECEIPT_MISMATCH");
    const mappedIds = Object.values(mapped.states);
    const first = sceneById.get(mappedIds[0]);
    const identityScene = mapped.identitySceneId ? sceneById.get(mapped.identitySceneId) : first;
    if (!identityScene || (mapped.identitySceneId && (locale !== null
      || !mapping.supersedesRevisionId
      || Date.parse(identityScene.capturedAt) > Date.parse(first.capturedAt)))) {
      die("SEO_CALL_IDENTITY_ORIGIN_INVALID");
    }
    const id = observedCallId(captureRunId, mapped.stepId, mapped.childCapabilityId, identityScene);
    if (mapped.observedCallId !== id) die("SEO_OBSERVED_CALL_ID_MISMATCH");
    const stateIds = Object.keys(mapped.states);
    if (stateIds.some((stateId) => !requirement.requiredLiveStates.includes(stateId)
      && !(requirement.optionalLiveStates ?? []).includes(stateId)
      && !matrix.commonRequiredDerivedStates.includes(stateId)
      && !requirement.childSpecificDerivedStates.includes(stateId))) die("SEO_CALL_STATE_UNPLANNED");
    for (const sceneId of mappedIds) {
      if (!sceneById.has(sceneId) || sceneOwners.has(sceneId)) die("SEO_CALL_SCENE_REUSED_OR_MISSING");
      sceneOwners.add(sceneId);
    }
    calls.push({ observedCallId: id, stepId: mapped.stepId,
      childCapabilityId: mapped.childCapabilityId, sceneIds: [...mappedIds],
      stateIds,
      promptHash: mapped.promptHash, turnMarkerHash: mapped.turnMarkerHash,
      ...(localeSegment ? { productStepId: "article_synthesis",
        sourceJobIdHash: localeSegment.jobIdHash,
        materialDigest: digest(localeSegment.materials) } : {}),
      ...(mapped.identitySceneId ? { identityOrigin: { sceneId: identityScene.sceneId,
        stateSignature: identityScene.stateSignature, capturedAt: identityScene.capturedAt } } : {}) });
    for (const [stateId, sceneId] of Object.entries(mapped.states)) {
      const scene = sceneById.get(sceneId);
      const built = makeLiveSpecimen({ child, requirement, stateId, scene, capture,
        mapping: { authorizedInputs: { "authorized-model-id": {
          values: [source.executionProfile.startModelDisplayName] } } },
        traceEntry: { inputBinding: { roleHashes: { promptHash: mapped.promptHash,
          turnMarkerHash: mapped.turnMarkerHash,
          assistantTurnIdHash: stageReceipt?.assistantTurnIdHash ?? null,
          responseHash: stageReceipt?.responseHash ?? null } } } });
      const key = `${mapped.childCapabilityId}/${stateId}`;
      const row = observations.get(key) ?? [];
      row.push({ observedCallId: id, sceneId,
        specimen: built.specimen, failures: built.failures });
      observations.set(key, row);
    }
  }
  const frozenFlow = freezeSeoFlow(localizationSource !== null);
  if (Object.entries(frozenFlow.productSourceHashes).some(([path, hash]) =>
    source.sourceHashes[path] !== hash)) die("SEO_PRODUCT_FLOW_PROJECTION_DRIFT");
  const cells = plan.flatMap((child) => child.stateIds.map((stateId) => {
    const rows = observations.get(`${child.childCapabilityId}/${stateId}`) ?? [];
    const childCalls = calls.filter((call) => call.childCapabilityId === child.childCapabilityId);
    const required = child.requiredLiveStates.includes(stateId);
    const applicable = childCalls.some((call) => {
      const branch = selectedSeoBranch(call, frozenFlow);
      return branch ? branch.includes(stateId) : required;
    });
    const missingRequired = rows.length === 0 && applicable && required;
    const noSpecimen = rows.some((row) => !row.specimen);
    const failed = rows.some((row) => row.failures.length > 0);
    const status = missingRequired || noSpecimen ? "CAPTURE_GAP" : rows.length === 0
      ? childCalls.length > 0 && required ? "NOT_APPLICABLE" : "NOT_REACHED"
      : failed ? "CONFLICT" : "OBSERVED";
    return { childCapabilityId: child.childCapabilityId, stateId, status,
      reason: missingRequired ? "required-state-not-mapped" : noSpecimen ? "target-not-found-in-scene"
        : rows.length === 0 ? "not-observed-in-this-seo-run"
        : failed ? rows.flatMap((row) => row.failures).join(",") : "same-run-scene-bound",
      observations: noSpecimen ? [] : rows.map(({ observedCallId: id, sceneId, specimen }) => ({ observedCallId: id,
        sceneId, specimen, fieldValues: fixedFieldValues({ captureRunId, observedCallId: id,
          childCapabilityId: child.childCapabilityId, stateId, scene: sceneById.get(sceneId), specimen }) })) };
  }));
  const receiptStages = stageReceipts.map((receipt) => receipt.stepId);
  const fullStages = ["corpus_research", "article_synthesis", "article_image_generation",
    ...(localizationSource ? localeOrder.map((locale) => `article_translation:${locale}`) : [])];
  const legalPrefix = JSON.stringify(receiptStages) === JSON.stringify(fullStages.slice(0, receiptStages.length));
  const allReceiptsBound = stageReceipts.every((receipt) => calls.some((call) =>
    call.observedCallId === receipt.observedCallId && call.sceneIds.includes(receipt.sceneId)));
  if (!allReceiptsBound || !legalPrefix || receiptStages.length > fullStages.length) {
    die("SEO_STAGE_RECEIPTS_INVALID");
  }
  const flowGaps = seoFlowGaps({ calls, cells, frozenFlow });
  const complete = flowGaps.length === 0 && receiptStages.length === fullStages.length
    && mapping.terminalBranch === (localizationSource ? "translation-complete" : "image-complete");
  const body = { schemaVersion: "gpt-page-seo-capture-revision.v1", captureRunId,
    capturedAt: new Date(Math.max(...scenes.map((scene) => Date.parse(scene.capturedAt)))).toISOString(),
    source, ...(localizationSource ? { localizationSource } : {}),
    matrixDigest: inventory.matrixBinding.digest,
    planDigest: digest(plan), frozenPlan: plan, flowDigest: digest(frozenFlow), frozenFlow, calls,
    scenes: scenes.filter((scene) => sceneOwners.has(scene.sceneId)).map((scene) => {
      const collectorProfile = mapping.sceneCollectorProfiles?.[scene.sceneId] ?? null;
      if (localizationSource && !sceneProfileNames.has(collectorProfile)) {
        die(`SEO_SCENE_COLLECTOR_PROFILE_MISSING:${scene.sceneId}`);
      }
      return { ...scene,
        observationScope: { schemaVersion: "gpt-page-scene-observation-scope.v1",
        collectorProfile,
        profileProvenance: collectorProfile === "CURRENT_TURN_NULL_UNREAD_V4"
          ? "SIGNED_PAGE_FACT" : "RETROSPECTIVE_ASSEMBLY_ANNOTATION",
        nodeCoverage: "SELECTED_VISIBLE_TARGETS_NOT_FULL_DOCUMENT",
        assistantSemanticCoverage: "NON_EXHAUSTIVE_CURRENT_MARKER_PROJECTION",
        previousResponseEmptyHashMeaning: "NOT_PROJECTED_OR_EMPTY",
        pageTurnCoverage: "CURRENTLY_MOUNTED_TURNS_ONLY" } };
    }), cells,
    stageReceipts, terminalBranch: mapping.terminalBranch ?? "unknown-effect",
    terminalReceipt: mapping.terminalReceipt ?? null,
    flowGaps,
    captureStatus: complete ? "CAPTURE_COMPLETE" : "CAPTURE_PARTIAL",
    supersedesRevisionId: mapping.supersedesRevisionId ?? null,
    correctionReason: mapping.correctionReason ?? null };
  const revision = sealSeoRevision(body);
  validateSeoRevision(revision);
  return revision;
}
