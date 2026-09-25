import { createHash } from "node:crypto";
import { executeOwnedFlow } from "../../../../src/plugins/localization-production/flow.ts";
import { parseProductResult } from "../../../../src/plugins/localization-production/result-contract.ts";
import { productResultValidation } from "../../../../src/mediator/product-plugin-contract.ts";
import { gptAttachmentProviderDisplayName } from "../../../../src/capabilities/gpt/schema.ts";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const fail = (code) => { throw new Error(code); };
const SENTINEL = Symbol("LOCALIZATION_PROMPT_CAPTURED_BEFORE_PROVIDER");
const localeOrder = ["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"];
const sourcePaths = ["src/plugins/localization-production/flow.ts",
  "src/plugins/localization-production/result-contract.ts",
  "src/plugins/localization-production/SKILL.md",
  "src/mediator/product-plugin-catalog.ts", "src/capabilities/gpt/schema.ts",
  "src/lib/local-runtime/production/website-agent-route-policies.v1.json"];
const materialRoles = ["source_content", "terminology", "locale_policy", "render_policy"];

export async function loadPinnedLocalizationTurn({ repo, assetsDir, locale }) {
  const ordinal = localeOrder.indexOf(locale);
  if (ordinal < 0) fail("LOCALIZATION_LOCALE_UNPLANNED");
  const root = resolve(repo), assets = resolve(assetsDir);
  const manifest = JSON.parse(await readFile(join(assets, "localization-source-manifest.json"), "utf8"));
  const entry = manifest.entries?.[ordinal];
  if (manifest.schemaVersion !== "gpt-page-localization-pinned-sources.v1"
    || !Array.isArray(manifest.entries) || manifest.entries.length !== 5
    || manifest.entries.some((item, index) => item.locale !== localeOrder[index])
    || manifest.websiteObjectBytesRead !== true
    || entry.locale !== locale || manifest.sourceRelationship !== "different-article-from-current-seo-qa-turn") {
    fail("LOCALIZATION_PINNED_MANIFEST_INVALID");
  }
  if (JSON.stringify(Object.keys(manifest.sourceCodeHashes ?? {}).sort())
    !== JSON.stringify([...sourcePaths].sort())
    || Object.values(manifest.sourceCodeHashes).some((hash) => !/^sha256:[a-f0-9]{64}$/u.test(hash))) {
    fail("LOCALIZATION_SOURCE_CODE_HASH_SET_INVALID");
  }
  for (const [path, hash] of Object.entries(manifest.sourceCodeHashes)) {
    if (sha(await readFile(join(root, path))) !== hash) fail(`LOCALIZATION_CODE_DRIFT:${path}`);
  }
  if (ordinal > 0 && entry.parentJobIdHash !== manifest.entries[ordinal - 1].jobIdHash) {
    fail("LOCALIZATION_PINNED_PARENT_ORDER_DRIFT");
  }
  if (manifest.entries.some((item) => item.sourceResourceIdHash !== entry.sourceResourceIdHash
    || item.sourceVersionHash !== entry.sourceVersionHash
    || item.sourceSha256 !== entry.sourceSha256)
    || manifest.rootArticleReadback?.articleIdHash !== entry.sourceResourceIdHash
    || manifest.rootArticleReadback?.sourceVersionHash !== entry.sourceVersionHash
    || manifest.rootArticleReadback?.articleMarkdownHash !== entry.sourceSha256
    || !/^sha256:[a-f0-9]{64}$/u.test(manifest.rootArticleReadback?.admissionReceiptHash ?? "")) {
    fail("LOCALIZATION_PINNED_SOURCE_ROOT_DRIFT");
  }
  const folder = join(assets, "private-localization", locale);
  const pinned = JSON.parse(await readFile(join(folder, "task-and-route.json"), "utf8"));
  const activeRouteCatalog = JSON.parse(await readFile(join(root,
    "src/lib/local-runtime/production/website-agent-route-policies.v1.json"), "utf8"));
  const activeRoutes = activeRouteCatalog.routes?.filter((row) =>
    row.product_id === "localization_article_translation"
    && row.action_id === "article_translation") ?? [];
  if (activeRoutes.length !== 1 || JSON.stringify(activeRoutes[0]) !== JSON.stringify(pinned.route)) {
    fail("LOCALIZATION_ACTIVE_ROUTE_DRIFT");
  }
  if (sha(JSON.stringify(pinned.task)) !== entry.taskEnvelopeHash
    || sha(JSON.stringify(pinned.resultRevision)) !== entry.resultRevisionHash
    || sha(JSON.stringify(pinned.parentReadback)) !== entry.parentReadbackHash
    || sha(pinned.task.job_id) !== entry.jobIdHash
    || sha(pinned.task.parent_task_ref) !== entry.parentJobIdHash
    || pinned.task.parent_result_hash !== entry.parentResultHash
    || pinned.task.request_hash !== entry.requestHash
    || pinned.task.parameters.target_locale !== locale
    || sha(pinned.task.parameters.source_resource_id) !== entry.sourceResourceIdHash
    || sha(pinned.task.parameters.source_version) !== entry.sourceVersionHash
    || pinned.task.parameters.source_sha256 !== entry.sourceSha256
    || pinned.parentReadback.resultPayloadRef !== pinned.task.parent_result_ref
    || pinned.parentReadback.resultPayloadHash !== pinned.task.parent_result_hash
    || pinned.parentReadback.terminalStatus !== "completed"
    || !pinned.parentReadback.acceptedAt || !pinned.parentReadback.businessConsumedAt
    || !pinned.parentReadback.businessConsumerRefHash
    || sha(JSON.stringify(pinned.route)) !== manifest.routePolicyHash) {
    fail("LOCALIZATION_PINNED_TASK_DRIFT");
  }
  if (pinned.task.material_refs?.length !== 4 || entry.materials?.length !== 4) {
    fail("LOCALIZATION_PINNED_MATERIAL_COUNT_DRIFT");
  }
  const materialFiles = await Promise.all(pinned.task.material_refs.map(async (ref, index) => {
    const expected = entry.materials[index];
    const bytesValue = await readFile(join(folder, ref.display_name));
    if (ref.role !== materialRoles[index] || ref.role !== expected?.role
      || ref.ordinal !== expected?.ordinal
      || ref.display_name !== expected.displayName
      || sha(ref.owner_scope_hash) !== expected.ownerScopeHashDigest
      || ref.bytes !== expected.bytes || ref.sha256 !== expected.sha256
      || sha(ref.material_id) !== expected.materialIdHash
      || bytesValue.length !== ref.bytes || sha(bytesValue) !== ref.sha256) {
      fail(`LOCALIZATION_PINNED_MATERIAL_DRIFT:${locale}:${index}`);
    }
    const providerName = gptAttachmentProviderDisplayName(ref.display_name,
      pinned.task.job_id, ref.material_id);
    const uploadPath = join(folder, "provider-upload", providerName);
    if (sha(await readFile(uploadPath)) !== ref.sha256) {
      fail(`LOCALIZATION_PROVIDER_COPY_DRIFT:${locale}:${index}`);
    }
    if (index === 0) {
      const sourceContent = JSON.parse(bytesValue.toString("utf8"));
      if (sourceContent.canonical_article_id !== pinned.task.parameters.source_resource_id
        || sourceContent.canonical_admitted_version !== pinned.task.parameters.source_version
        || sourceContent.canonical_admitted_hash !== pinned.task.parameters.source_sha256
        || sourceContent.locale !== locale) fail("LOCALIZATION_PINNED_CONTENT_IDENTITY_DRIFT");
    }
    return { ...ref, local_path: join(folder, ref.display_name), upload_path: uploadPath,
      bytesValue };
  }));
  const productSkillText = await readFile(join(root, "src/plugins/localization-production/SKILL.md"), "utf8");
  return Object.freeze({ task: pinned.task, route: pinned.route,
    resultRevision: pinned.resultRevision, materialFiles, productSkillText,
    source: entry, codeHashes: manifest.sourceCodeHashes });
}

/** Calls the production flow in a closed memory context and stops before prompt write. */
export async function prepareLocalizationTurn({ task, route, resultRevision, materialFiles,
  productSkillText }) {
  if (task?.product_id !== "localization_article_translation"
    || task?.action_id !== "article_translation" || route?.relation_kind !== "provider_continuation"
    || !Array.isArray(materialFiles) || materialFiles.length !== 4
    || materialFiles.some((entry, ordinal) => entry.ordinal !== ordinal
      || entry.sha256 !== sha(entry.bytesValue)
      || entry.bytes !== entry.bytesValue.length)
    || !Number.isSafeInteger(resultRevision?.revision)
    || !("priorRejection" in resultRevision) || typeof productSkillText !== "string") {
    fail("LOCALIZATION_QA_SOURCE_INVALID");
  }
  let prompt = null;
  const materials = materialFiles.map(({ bytesValue, ...metadata }) => metadata);
  const uploaded = materials.map((material) => ({ artifactRef: material.material_id,
    displayName: material.display_name,
    providerDisplayName: gptAttachmentProviderDisplayName(material.display_name,
      task.job_id, material.material_id),
    sha256: material.sha256, bytes: material.bytes }));
  const gpt = Object.freeze({ jobId: task.job_id, attemptId: "qa-prompt-probe-no-effect",
    readConfirmedSubmit: async () => null,
    execute: async (call) => {
      if (call.child === "write_exact_gpt_prompt") {
        prompt = call.input.prompt;
        throw SENTINEL;
      }
      if (["open_gpt_execution_profile", "open_gpt_model_selector_v3",
        "select_gpt_model_from_start_v3", "select_gpt_reasoning_from_start_v3",
        "close_gpt_execution_profile", "open_gpt_attachment_control",
        "attach_approved_gpt_files_once"].includes(call.child)) return { artifactRefs: [], value: {} };
      if (call.child === "reconcile_gpt_attachment_set") {
        return { artifactRefs: [], value: { files: uploaded } };
      }
      fail(`LOCALIZATION_PROBE_UNEXPECTED_CHILD:${call.child}`);
    } });
  try {
    await executeOwnedFlow(task, { materials, routePolicy: route,
      productSkill: { text: productSkillText.normalize("NFC"),
        hash: sha(productSkillText.normalize("NFC")) },
      resultRevision, gpt, complete: () => fail("LOCALIZATION_PROBE_COMPLETE_FORBIDDEN"),
      uploadGeneratedImage: () => fail("LOCALIZATION_PROBE_IMAGE_FORBIDDEN") });
  } catch (error) {
    if (error !== SENTINEL) throw error;
  }
  if (typeof prompt !== "string" || !prompt.includes("当前授权动作：article_translation")) {
    fail("LOCALIZATION_PROMPT_NOT_CAPTURED");
  }
  const markers = [...prompt.matchAll(/\[GRASSEYE:[a-f0-9]{24}\]/gu)];
  if (markers.length !== 1) fail("LOCALIZATION_MARKER_AMBIGUOUS");
  return Object.freeze({ locale: task.parameters.target_locale, marker: markers[0][0],
    prompt, promptHash: sha(prompt), turnMarkerHash: sha(markers[0][0]),
    files: Object.freeze(uploaded) });
}

/** Product parsing only; this is not Website admission. */
export function acceptLocalizationTextTurn({ prepared, task, route, observedCallId, scene,
  exactAssistant }) {
  const userBindings = scene?.pageFacts?.userTurnBindings?.filter((entry) =>
    entry.promptHash === prepared?.promptHash
    && entry.turnMarkerHashes?.includes(prepared?.turnMarkerHash)) ?? [];
  const assistantBindings = scene?.pageFacts?.conversationTurnBindings?.filter((entry) =>
    entry.precedingPromptHash === prepared?.promptHash
    && entry.turnMarkerHashes?.includes(prepared?.turnMarkerHash)
    && entry.responseHash === exactAssistant?.semanticTextHash
    && entry.assistantTurnIdHash === exactAssistant?.assistantTurnIdHash) ?? [];
  if (!observedCallId || !scene || !exactAssistant
    || prepared?.locale !== task?.parameters?.target_locale
    || userBindings.length !== 1 || !userBindings[0].userTurnIdHash
    || assistantBindings.length !== 1 || !assistantBindings[0].assistantTurnIdHash
    || exactAssistant.promptHash !== prepared.promptHash
    || exactAssistant.semanticTextHash !== sha(exactAssistant.semanticText)
    || exactAssistant.documentIdentityHash !== scene.documentIdentityHash
    || exactAssistant.observationRevisionHash !== scene.observationRevisionHash
    || scene.pageFacts?.currentRouteKind !== "CONVERSATION") {
    fail("LOCALIZATION_ASSISTANT_EXACT_SCENE_BINDING_INVALID");
  }
  const value = productResultValidation.parseJsonObject(exactAssistant.semanticText,
    "PRODUCT_RESULT_JSON_INVALID");
  const parsed = parseProductResult(task, value, route);
  return Object.freeze({ observedCallId, locale: prepared.locale,
    sceneId: scene.sceneId, promptHash: prepared.promptHash,
    turnMarkerHash: prepared.turnMarkerHash,
    responseHash: exactAssistant.semanticTextHash,
    assistantTurnIdHash: exactAssistant.assistantTurnIdHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash,
    parsedResultHash: sha(JSON.stringify(parsed)) });
}
