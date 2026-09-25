import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { appendSeoRevision, compareSeoRevision, fixedFieldValues, freezeSeoFlow, migrateV7Envelope, sealSeoRevision, validateSeoReportExtension,
  validateSeoRevision, readSeoReport, seoActionConflicts, seoFlowGaps, seoStageCoverageGaps,
  selectedSeoBranch } from "./seo-report-revisions.mjs";
import { assertSeoSourceAdmission } from "./seo-live-source.mjs";
import { candidateEntries, targetEvidence } from "./assemble-live-capture.mjs";

const repo = resolve(new URL("../../../../", import.meta.url).pathname);
const matrix = JSON.parse(await readFile(join(repo,
  ".agents/skills/gpt-page-operation-evidence/references/page-operation-matrix.json"), "utf8"));
for (const child of matrix.children) {
  for (const [stateId, targets] of Object.entries(child.liveStateTargets)) {
    assert.ok(targets.length > 0, `${child.childCapabilityId}/${stateId}:no-positive-anchor`);
    for (const assertion of child.stateAssertions?.[stateId] ?? []) {
      if (assertion.operator !== "absent" || !assertion.path.startsWith("core.targets.")) continue;
      const target = assertion.path.slice("core.targets.".length);
      assert.ok(!targets.includes(target),
        `${child.childCapabilityId}/${stateId}:required-and-absent:${target}`);
    }
  }
}
const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stable(value[key])])) : value;
const digest = (value) => sha(JSON.stringify(stable(value)));

function sample(runId, supersedesRevisionId = null) {
  const source = { sourceKind: "LIVE_SEO_CAPTURE_SESSION_INPUT",
    productId: "public_knowledge_article_pipeline", actionId: "produce_article",
    jobIdHash: sha("job"), requestHash: sha("request"), taskEnvelopeHash: sha("task"),
    archiveHash: sha("archive"), archiveBytes: 100,
    executionProfile: { startModelDisplayName: "最新", requestedReasoningValue: 4 },
    archiveEntries: ["a", "b", "c", "d"].map((value) => ({ pathHash: sha(value),
      sha256: sha(value), bytes: 1 })),
    sourceHashes: Object.fromEntries([
      "src/plugins/public-knowledge-article-pipeline/index.ts",
      "src/plugins/public-knowledge-article-pipeline/seo-turn-prompts.ts",
      "src/plugins/public-knowledge-article-pipeline/seo-turn-contract.ts",
      "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts",
      "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts",
      "src/plugins/public-knowledge-article-pipeline/result-contract.ts",
      "src/capabilities/gpt/contract.ts",
      "src/lib/browser/chrome-extension/dom-semantic-text.ts",
      "src/lib/local-runtime/production/website-agent-route-policies.v1.json",
    ].map((path) => [path, sha(path)])) };
  const scene = { sceneId: `scene-${runId}`, capturedAt: "2026-09-24T00:00:00.000Z",
    url: "https://chatgpt.com/", activeTabIdentityHash: sha("tab"),
    documentIdentityHash: sha("document"), nodeCount: 1,
    nodes: [{ tag: "div", connected: true,
      attributes: { "data-composer-markdown": "", role: "textbox" },
      ancestors: [{ tag: "form", role: null, testId: null }] }],
    pageFacts: { capturedAttributeNames: ["data-composer-markdown", "role"],
      exactUserPromptHashes: [sha("prompt")], conversationTurnBindings: [{
      precedingPromptHash: sha("prompt"), responseHash: sha("response"),
      assistantTurnIdHash: sha("turn") }] },
    binding: { runId, captureEpoch: sha("epoch"), qaTabIdentityHash: sha("tab"),
      sourceInputHash: digest(source) },
    decisionReceipt: null, transitionReceipt: null };
  scene.observationRevisionHash = sha(JSON.stringify({ documentIdentityHash: scene.documentIdentityHash,
    url: scene.url, nodes: scene.nodes, pageFacts: scene.pageFacts }));
  scene.stateSignature = sha(JSON.stringify({ url: scene.url,
    activeTabIdentityHash: scene.activeTabIdentityHash,
    documentIdentityHash: scene.documentIdentityHash,
    observationRevisionHash: scene.observationRevisionHash, nodeCount: scene.nodeCount,
    nodes: scene.nodes, pageFacts: scene.pageFacts, binding: scene.binding,
    decisionReceipt: scene.decisionReceipt, transitionReceipt: scene.transitionReceipt }));
  const observedCallId = sha(`call:${runId}`);
  const specimen = { sourceSceneId: scene.sceneId, sourceSceneSignature: scene.stateSignature,
    targetIdentityHash: sha("composer-target"),
    documentIdentityHash: scene.documentIdentityHash, revision: scene.observationRevisionHash,
    stateFacts: { stateId: "pre", observed: true },
    core: { scope: { candidateCount: 1, qualifiedCount: 1 }, candidates: [], sanitizedOuterHtml: "<main></main>",
      attributes: { "data-composer-markdown": "", role: "textbox" }, connected: true,
      targets: { composer: { observed: true, identityHash: sha("composer-target"), nodeIndex: 0,
        tag: "div",
        attributes: { "data-composer-markdown": "", role: "textbox" } } },
      actionQualification: { qualified: true },
      computedStyle: { display: "block" }, layout: { width: 1, height: 1 } },
    related: { ancestors: [], siblings: [], linkedNodes: [],
      transitionChain: { directPostcondition: { passed: true } } } };
  const fieldValues = fixedFieldValues({ captureRunId: runId, observedCallId,
    childCapabilityId: "prepare_clean_gpt_chat", stateId: "pre", scene, specimen });
  const plan = [{ childCapabilityId: "prepare_clean_gpt_chat", stateIds: ["pre"],
    requiredLiveStates: ["pre"], fixedCaptureFields: Object.keys(fieldValues),
    codePaths: ["src/capabilities/gpt/children/prepare_clean_gpt_chat/selectors.ts",
      "src/lib/browser/chrome-extension/dom-coherent-candidate.ts",
      "src/lib/browser/chrome-extension/dom-mechanical-facts.ts"],
    codeTargetSelectors: { composer: "GPT_COMPOSER_SELECTOR" },
    stateAssertions: { pre: [] }, liveStateTargets: { pre: ["composer"] } }];
  const frozenFlow = { expectedCalls: [{ stepId: "corpus_research",
    childCapabilityId: "prepare_clean_gpt_chat" }],
  terminalStates: { prepare_clean_gpt_chat: ["pre"] },
  stateBranches: { prepare_clean_gpt_chat: [["pre"]] },
  productSourceHashes: { "src/plugins/public-knowledge-article-pipeline/index.ts":
    source.sourceHashes["src/plugins/public-knowledge-article-pipeline/index.ts"] } };
  return sealSeoRevision({ schemaVersion: "gpt-page-seo-capture-revision.v1", captureRunId: runId,
    capturedAt: scene.capturedAt,
    source, matrixDigest: sha("matrix"),
    planDigest: digest(plan), frozenPlan: plan, flowDigest: digest(frozenFlow), frozenFlow,
    calls: [{ observedCallId, stepId: "corpus_research", childCapabilityId: "prepare_clean_gpt_chat",
      promptHash: sha("prompt"), turnMarkerHash: sha("marker"),
      stateIds: ["pre"],
      sceneIds: [scene.sceneId] }], scenes: [scene],
    cells: [{ childCapabilityId: "prepare_clean_gpt_chat", stateId: "pre", status: "OBSERVED",
      reason: "test-only-scene", observations: [{ observedCallId, sceneId: scene.sceneId,
        specimen, fieldValues }] }],
    stageReceipts: [{ observedCallId, sceneId: scene.sceneId,
      stepId: "corpus_research", promptHash: sha("prompt"),
      responseHash: sha("response"), assistantTurnIdHash: sha("turn"), decision: "proceed",
      documentIdentityHash: scene.documentIdentityHash,
      observationRevisionHash: scene.observationRevisionHash }],
    terminalBranch: "qa-stopped", terminalReceipt: { stepId: "corpus_research",
      observedCallId, sceneId: scene.sceneId, providerEffect: "no", reasonHash: sha("test stop") },
    flowGaps: seoFlowGaps({ frozenFlow, calls: [{ observedCallId,
      stepId: "corpus_research", childCapabilityId: "prepare_clean_gpt_chat", stateIds: ["pre"] }],
      cells: [{ childCapabilityId: "prepare_clean_gpt_chat", stateId: "pre", status: "OBSERVED",
        observations: [{ observedCallId }] }] }),
    captureStatus: "CAPTURE_PARTIAL", supersedesRevisionId,
    correctionReason: supersedesRevisionId ? "test correction" : null });
}

async function main() {
  const strictPrefix = { schemaVersion: "gpt-page-seo-capture-revision.v2",
    frozenFlow: freezeSeoFlow(true), source: { executionProfile: {
      startModelDisplayName: "最新", requestedReasoningValue: 4 } },
    frozenPlan: [{ childCapabilityId: "submit_exact_gpt_turn_once",
      liveStateTargets: { "pre-submit-ready": ["composer", "submit-control"] },
      stateAssertions: { "pre-submit-ready": [{ path: "stateFacts.capturePhase",
        operator: "equals", value: "PRE_ACTION" }] } }],
    calls: [{ observedCallId: sha("strict-prefix-call"), stepId: "corpus_research",
      childCapabilityId: "submit_exact_gpt_turn_once", stateIds: ["pre-submit-ready"],
      sceneIds: ["strict-prefix-scene"], expectedAttachmentLabelHashes: [sha("approved")] }],
    scenes: [{ sceneId: "strict-prefix-scene", pageFacts: {},
      decisionReceipt: { kind: "ACTION_REQUIRED" }, transitionReceipt: null }],
    cells: [{ childCapabilityId: "submit_exact_gpt_turn_once",
      stateId: "pre-submit-ready", observations: [{ observedCallId: sha("strict-prefix-call"),
        sceneId: "strict-prefix-scene", specimen: {
          stateFacts: { capturePhase: "PRE_ACTION" },
          core: { targets: { composer: { observed: true, identityHash: sha("composer") },
            "submit-control": { observed: true, identityHash: sha("submit") } },
          actionQualification: { qualified: true } },
          related: { transitionChain: { typedCommand: { kind: "NOT_APPLICABLE" },
            directPostcondition: { passed: true } } } } }] }],
    stageReceipts: [{ stepId: "corpus_research" }] };
  assert.ok(seoStageCoverageGaps(strictPrefix, "corpus_research").includes(
    "unqualified-branch-state:corpus_research/submit_exact_gpt_turn_once/pre-submit-ready"));
  const hashedValue = (value) => ({ kind: "HASH_ONLY", sha256: sha(value), length: value.length });
  const capturedNode = (tag, attributes, machineFacts, subtreeText = "") => ({
    tag, attributes, machineFacts, connected: true,
    rect: { x: 0, y: 0, width: tag === "input" ? 0 : 20,
      height: tag === "input" ? 0 : 20 },
    style: { display: tag === "input" ? "none" : "block", visibility: "visible", opacity: "1" },
    textProjection: hashedValue(""), subtreeTextProjection: hashedValue(subtreeText),
  });
  const currentScene = { sceneId: "v2-target-scene", stateSignature: sha("v2-target-scene"), nodes: [
    capturedNode("button", { "aria-label": hashedValue("添加文件等内容") },
      { composerFormAncestor: true }),
    capturedNode("button", {}, { activeAttachmentPopoverAncestor: true }, "添加照片和文件"),
    capturedNode("input", { type: "file", "aria-label": hashedValue("附加文件") },
      { composerFormAncestor: true }),
    capturedNode("button", { type: "submit", "aria-label": hashedValue("发送") },
      { composerFormAncestor: true }),
  ], pageFacts: { captureScope: { schemaVersion: "gpt-page-collector-scope.v2" } } };
  for (const target of ["attachment-trigger", "attachment-menu", "upload-entry", "file-input",
    "submit-control"]) assert.equal(candidateEntries(target, currentScene).length, 1, target);
  assert.equal(targetEvidence("file-input", currentScene).record?.observed, true);
  assert.equal(targetEvidence("file-input", currentScene).qualifiedCount, 1);
  const wrongFileInput = { ...currentScene, nodes: [capturedNode("input", {
    type: "file", "aria-label": hashedValue("其它文件输入") }, { composerFormAncestor: true })] };
  assert.equal(targetEvidence("file-input", wrongFileInput).record, undefined);
  assert.equal(targetEvidence("file-input", wrongFileInput).qualifiedCount, 0);
  const oldScopeScene = { ...currentScene, pageFacts: { captureScope: {
    schemaVersion: "gpt-page-collector-scope.v1" } } };
  for (const target of ["attachment-menu", "upload-entry", "file-input"]) {
    assert.equal(candidateEntries(target, oldScopeScene).length, 0, `v1:${target}`);
  }
  const coveredSpecimen = { core: { targets: { composer: { observed: true,
    identityHash: sha("target") } } }, related: { transitionChain: {
    typedCommand: { kind: "NOT_APPLICABLE" },
    directPostcondition: { passed: true } } } };
  const coverage = { schemaVersion: "gpt-page-seo-capture-revision.v2",
    frozenFlow: { expectedCalls: [{ stepId: "corpus_research", childCapabilityId: "child" }],
      stateBranches: { child: [["pre", "post"]] }, terminalStates: { child: ["post"] } },
    frozenPlan: [{ childCapabilityId: "child", liveStateTargets: {
      pre: ["composer"], post: ["composer"] } }],
    calls: [{ observedCallId: "call", stepId: "corpus_research",
      childCapabilityId: "child", stateIds: ["pre", "post"] }],
    cells: [{ childCapabilityId: "child", stateId: "pre", status: "CONFLICT",
      observations: [{ observedCallId: "call", specimen: coveredSpecimen }] },
    { childCapabilityId: "child", stateId: "post", status: "OBSERVED",
      observations: [{ observedCallId: "call", specimen: structuredClone(coveredSpecimen) }] }],
    stageReceipts: [{ stepId: "corpus_research" }] };
  assert.deepEqual(seoStageCoverageGaps(coverage, "corpus_research"), []);
  assert.deepEqual(seoStageCoverageGaps({ ...coverage, stageReceipts: [] },
    "corpus_research"), ["missing-stage-receipt:corpus_research"]);
  assert.deepEqual(seoStageCoverageGaps({ ...coverage, cells: coverage.cells.slice(0, 1) },
    "corpus_research"), ["missing-branch-state:corpus_research/child/post"]);
  const diagnostic = structuredClone(coverage);
  diagnostic.cells[1].observations[0].specimen.core.targets.composer.observed = false;
  assert.deepEqual(seoStageCoverageGaps(diagnostic, "corpus_research"),
    ["missing-branch-state:corpus_research/child/post"]);
  const noCommand = structuredClone(coverage);
  noCommand.cells[1].observations[0].specimen.related.transitionChain.typedCommand.kind = "EVIDENCE_MISSING";
  assert.deepEqual(seoStageCoverageGaps(noCommand, "corpus_research"),
    ["missing-branch-state:corpus_research/child/post"]);
  const failedAction = structuredClone(coverage);
  failedAction.cells[1].observations[0].specimen.related.transitionChain.typedCommand.kind = "ZERO_ACTION";
  failedAction.cells[1].observations[0].specimen.related.transitionChain.directPostcondition.passed = false;
  assert.deepEqual(seoStageCoverageGaps(failedAction, "corpus_research"), []);
  assert.deepEqual(seoActionConflicts(failedAction, "corpus_research"),
    ["failed-postcondition:corpus_research/child/post"]);
  const attachStates = ["upload-leaf-ready", "file-chooser-bound", "file-set-readback"];
  const attachScene = { sceneId: "attach-scene", pageFacts: { attachmentSetProof: {
    expectedLabelHashes: [sha("file")], observedNormalizedLabelHashes: [sha("file")],
    formCount: 1, expectedCount: 1, rawCount: 1, eligibleCount: 1,
    missingCount: 0, unexpectedCount: 0, duplicateCount: 0 } },
  decisionReceipt: { kind: "ALREADY_SATISFIED" }, stateSignature: sha("attach-scene") };
  const attachSpecimen = (target) => ({ stateFacts: { capturePhase: "ALREADY_SATISFIED",
    attachmentSetProof: attachScene.pageFacts.attachmentSetProof },
  core: { targets: { [target]: { observed: true, identityHash: sha(target) } },
    actionQualification: { qualified: true } }, related: { transitionChain: {
    typedCommand: { kind: "ZERO_ACTION" }, directPostcondition: { passed: true } } } });
  const attachCoverage = { schemaVersion: "gpt-page-seo-capture-revision.v2",
    frozenFlow: { expectedCalls: [{ stepId: "corpus_research",
      childCapabilityId: "attach_approved_gpt_files_once" }],
    stateBranches: { attach_approved_gpt_files_once: [attachStates] },
    terminalStates: { attach_approved_gpt_files_once: ["file-set-readback"] } },
    frozenPlan: [{ childCapabilityId: "attach_approved_gpt_files_once",
      liveStateTargets: Object.fromEntries(attachStates.map((state, index) =>
        [state, [["upload-entry", "file-input", "attachment-cards"][index]]])) }],
    calls: [{ observedCallId: "attach-call", stepId: "corpus_research",
      childCapabilityId: "attach_approved_gpt_files_once", stateIds: attachStates,
      sceneIds: [attachScene.sceneId], expectedAttachmentLabelHashes: [sha("file")] }],
    scenes: [attachScene], cells: attachStates.map((state, index) => ({
      childCapabilityId: "attach_approved_gpt_files_once", stateId: state,
      observations: [{ observedCallId: "attach-call", sceneId: attachScene.sceneId,
        specimen: attachSpecimen(["upload-entry", "file-input", "attachment-cards"][index]) }] })) };
  assert(seoFlowGaps(attachCoverage, true).includes(
    "unqualified-branch-state:corpus_research/attach_approved_gpt_files_once/file-set-readback"));
  const uploaded = structuredClone(attachCoverage);
  uploaded.calls[0].expectedUploadFiles = [{ providerDisplayNameHash: sha("file"),
    sha256: sha("file-bytes"), bytes: 10 }];
  uploaded.scenes[0].capturedAt = "2026-09-24T00:00:03.000Z";
  uploaded.scenes[0].documentIdentityHash = sha("upload-document");
  uploaded.scenes[0].activeTabIdentityHash = sha("upload-tab");
  const uploadPre = { sceneId: "upload-pre", capturedAt: "2026-09-24T00:00:01.000Z",
    documentIdentityHash: sha("upload-document"), activeTabIdentityHash: sha("upload-tab"),
    stateSignature: sha("upload-pre"), decisionReceipt: { kind: "ACTION_REQUIRED",
      actionId: "upload-action", operation: "filechooser.setFiles" } };
  const uploadPost = { sceneId: "upload-post", capturedAt: "2026-09-24T00:00:02.000Z",
    documentIdentityHash: sha("upload-document"), activeTabIdentityHash: sha("upload-tab"),
    transitionReceipt: { outcome: "DISPATCH_RETURNED", operation: "filechooser.setFiles",
      actionId: "upload-action", preSceneId: uploadPre.sceneId,
      preSceneSignature: uploadPre.stateSignature, postconditionPassed: true,
      uploadedArtifactProof: { source: "SIGNED_COMMAND_ARGUMENTS",
        items: structuredClone(uploaded.calls[0].expectedUploadFiles) } } };
  uploaded.scenes.push(uploadPre, uploadPost);
  uploaded.calls[0].sceneIds = [uploadPre.sceneId, uploadPost.sceneId, attachScene.sceneId];
  assert(!seoFlowGaps(uploaded, true).some((gap) => gap.endsWith("/file-set-readback")));
  uploaded.scenes[2].transitionReceipt.uploadedArtifactProof.items[0].sha256 = sha("wrong-bytes");
  assert(seoFlowGaps(uploaded, true).some((gap) => gap.endsWith("/file-set-readback")));
  const prefix = structuredClone(coverage);
  prefix.frozenFlow.expectedCalls.push({ stepId: "article_synthesis", childCapabilityId: "child" });
  prefix.calls.push({ observedCallId: "article-call", stepId: "article_synthesis",
    childCapabilityId: "child", stateIds: ["pre", "post"] });
  prefix.stageReceipts.push({ stepId: "article_synthesis" });
  prefix.cells[0].observations.push({ observedCallId: "article-call",
    specimen: structuredClone(coveredSpecimen) });
  prefix.cells[1].observations.push({ observedCallId: "article-call",
    specimen: structuredClone(coveredSpecimen) });
  prefix.calls[0].stateIds = [];
  assert(seoStageCoverageGaps(prefix, "article_synthesis").some((gap) =>
    gap.startsWith("ambiguous-branch:corpus_research/")));
  await assert.rejects(appendSeoRevision({ revision: { terminalBranch: "stage-paused" } }),
    /SEO_STAGE_PAUSE_NOT_PUBLISHABLE/u);
  assert.throws(() => validateSeoRevision(sealSeoRevision({ ...sample("v2-no-locales"),
    schemaVersion: "gpt-page-seo-capture-revision.v2" })),
  /SEO_V2_FIVE_LOCALE_SOURCE_REQUIRED/u);
  assert.deepEqual(seoFlowGaps({ ...coverage, schemaVersion: "gpt-page-seo-capture-revision.v1" }),
    ["missing-branch-state:corpus_research/child/pre", "cell-conflict:child/pre"]);
  assert.throws(() => migrateV7Envelope({ schemaVersion: "gpt-page-operation-evidence.v7",
    products: [], seoCaptureRevisions: [] }, Buffer.from("partial")), /SEO_V7_MIGRATION_SOURCE_INVALID/u);
  const legacyRun = { sourceSnapshotId: sha("old-source"), calls: [] };
  const legacy = { schemaVersion: "gpt-page-operation-evidence.v8",
    products: [{ productKey: "old/route", runs: [legacyRun] }],
    legacyV7: { reportHash: sha("old"), productDigests: [{ productKey: "old/route",
      digest: digest({ productKey: "old/route", runs: [legacyRun] }) }],
      runDigests: [{ productKey: "old/route",
      sourceSnapshotId: legacyRun.sourceSnapshotId, digest: digest(legacyRun) }] },
    seoCaptureRevisions: [] };
  assert.equal(validateSeoReportExtension(legacy), true);
  const changedProduct = structuredClone(legacy);
  changedProduct.products[0].captureStatus = "CAPTURE_COMPLETE";
  assert.throws(() => validateSeoReportExtension(changedProduct), /SEO_LEGACY_PRODUCT_CHANGED/u);
  const deletedProduct = structuredClone(legacy);
  deletedProduct.products = [];
  assert.throws(() => validateSeoReportExtension(deletedProduct), /SEO_LEGACY_RUN_CHANGED|SEO_LEGACY_PRODUCT_CHANGED/u);
  legacy.products[0].runs[0].calls.push({ invented: true });
  assert.throws(() => validateSeoReportExtension(legacy), /SEO_LEGACY_RUN_CHANGED/u);
  const folder = await mkdtemp(join(tmpdir(), "seo-revision-test-"));
  const reportPath = join(folder, "report.json");
  const comparisonPath = join(folder, "comparison.md");
  const baseline = { schemaVersion: "gpt-page-operation-evidence.v8", products: [],
    legacyV7: { reportHash: sha("old"), runDigests: [], productDigests: [] }, seoCaptureRevisions: [] };
  await writeFile(reportPath, JSON.stringify(baseline));
  const first = sample("test-run-1"), second = sample("test-run-2");
  assert.equal(validateSeoRevision(first), true);
  const wrongDocumentReceipt = structuredClone(first);
  wrongDocumentReceipt.stageReceipts[0].documentIdentityHash = sha("wrong-document");
  assert.throws(() => validateSeoRevision(sealSeoRevision({ ...wrongDocumentReceipt,
    evidenceRevisionId: undefined, contentHash: undefined })), /SEO_REVISION_STAGE_RECEIPT_INVALID/u);
  const wrongRevisionReceipt = structuredClone(first);
  wrongRevisionReceipt.stageReceipts[0].observationRevisionHash = sha("wrong-revision");
  assert.throws(() => validateSeoRevision(sealSeoRevision({ ...wrongRevisionReceipt,
    evidenceRevisionId: undefined, contentHash: undefined })), /SEO_REVISION_STAGE_RECEIPT_INVALID/u);
  const matched = await compareSeoRevision(repo, first);
  assert.ok(matched.rows.some((row) => row.field === "attributes.composer.role" && row.verdict === "MATCH"));
  assert.ok(matched.rows.some((row) => row.field === "candidateCount.codeSelectorRaw"
    && row.verdict === "REVIEW_REQUIRED"));
  assert.ok(matched.rows.some((row) => row.field === "relatedNodes.scope.composer.data-chatgpt-composer"
    && row.verdict === "REVIEW_REQUIRED"));
  assert.ok(matched.rows.some((row) => row.field === "visibilityAndLayout.connected" && row.verdict === "MATCH"));
  const selectorDrift = structuredClone(first);
  selectorDrift.cells[0].observations[0].specimen.core.targets.composer.attributes.role = "button";
  const drifted = await compareSeoRevision(repo, sealSeoRevision({ ...selectorDrift,
    evidenceRevisionId: undefined, contentHash: undefined }));
  assert.ok(drifted.rows.some((row) => row.field === "attributes.composer.role" && row.verdict === "DRIFT"));
  const absentCapturedAttribute = structuredClone(first);
  delete absentCapturedAttribute.cells[0].observations[0].specimen.core.targets.composer.attributes["data-composer-markdown"];
  absentCapturedAttribute.cells[0].observations[0].fieldValues = fixedFieldValues({
    captureRunId: absentCapturedAttribute.captureRunId,
    observedCallId: absentCapturedAttribute.calls[0].observedCallId,
    childCapabilityId: "prepare_clean_gpt_chat", stateId: "pre",
    scene: absentCapturedAttribute.scenes[0],
    specimen: absentCapturedAttribute.cells[0].observations[0].specimen });
  const absentRows = await compareSeoRevision(repo, sealSeoRevision({ ...absentCapturedAttribute,
    evidenceRevisionId: undefined, contentHash: undefined }));
  assert.ok(absentRows.rows.some((row) => row.field === "attributes.composer.data-composer-markdown"
    && row.verdict === "DRIFT"));
  const uncollectedAttribute = structuredClone(absentCapturedAttribute);
  uncollectedAttribute.scenes[0].pageFacts.capturedAttributeNames = ["role"];
  const uncollectedScene = uncollectedAttribute.scenes[0];
  uncollectedScene.observationRevisionHash = sha(JSON.stringify({
    documentIdentityHash: uncollectedScene.documentIdentityHash,
    url: uncollectedScene.url, nodes: uncollectedScene.nodes, pageFacts: uncollectedScene.pageFacts }));
  uncollectedScene.stateSignature = sha(JSON.stringify({ url: uncollectedScene.url,
    activeTabIdentityHash: uncollectedScene.activeTabIdentityHash,
    documentIdentityHash: uncollectedScene.documentIdentityHash,
    observationRevisionHash: uncollectedScene.observationRevisionHash,
    nodeCount: uncollectedScene.nodeCount, nodes: uncollectedScene.nodes,
    pageFacts: uncollectedScene.pageFacts, binding: uncollectedScene.binding,
    decisionReceipt: uncollectedScene.decisionReceipt,
    transitionReceipt: uncollectedScene.transitionReceipt }));
  const uncollectedObservation = uncollectedAttribute.cells[0].observations[0];
  uncollectedObservation.specimen.sourceSceneSignature = uncollectedScene.stateSignature;
  uncollectedObservation.specimen.revision = uncollectedScene.observationRevisionHash;
  uncollectedObservation.fieldValues = fixedFieldValues({
    captureRunId: uncollectedAttribute.captureRunId,
    observedCallId: uncollectedAttribute.calls[0].observedCallId,
    childCapabilityId: "prepare_clean_gpt_chat", stateId: "pre",
    scene: uncollectedScene, specimen: uncollectedObservation.specimen });
  uncollectedAttribute.stageReceipts[0].observationRevisionHash = uncollectedScene.observationRevisionHash;
  const uncollectedRows = await compareSeoRevision(repo, sealSeoRevision({ ...uncollectedAttribute,
    evidenceRevisionId: undefined, contentHash: undefined }));
  assert.ok(uncollectedRows.rows.some((row) => row.field === "attributes.composer.data-composer-markdown"
    && row.verdict === "REVIEW_REQUIRED"));
  const codeOnly = structuredClone(first);
  codeOnly.frozenPlan[0].liveStateTargets.pre = ["page-root"];
  codeOnly.planDigest = digest(codeOnly.frozenPlan);
  const codeOnlyRows = await compareSeoRevision(repo, sealSeoRevision({ ...codeOnly,
    evidenceRevisionId: undefined, contentHash: undefined }));
  assert.ok(codeOnlyRows.rows.some((row) => row.field === "codeSelector.composer"
    && row.verdict === "CODE_ONLY"));
  const ambiguous = structuredClone(first);
  ambiguous.frozenPlan[0].codeTargetSelectors.composer = "NONEXISTENT_SELECTOR";
  ambiguous.planDigest = digest(ambiguous.frozenPlan);
  const ambiguousRows = await compareSeoRevision(repo, sealSeoRevision({ ...ambiguous,
    evidenceRevisionId: undefined, contentHash: undefined }));
  assert.ok(ambiguousRows.rows.some((row) => row.field === "attributes"
    && row.verdict === "REVIEW_REQUIRED"));
  const unobserved = structuredClone(first);
  unobserved.frozenPlan[0].stateIds.push("optional-unseen");
  unobserved.frozenPlan[0].stateAssertions["optional-unseen"] = [];
  unobserved.frozenPlan[0].liveStateTargets["optional-unseen"] = ["composer"];
  unobserved.planDigest = digest(unobserved.frozenPlan);
  unobserved.cells.push({ childCapabilityId: "prepare_clean_gpt_chat", stateId: "optional-unseen",
    status: "NOT_REACHED", reason: "not-observed", observations: [] });
  const unobservedRows = await compareSeoRevision(repo, sealSeoRevision({ ...unobserved,
    evidenceRevisionId: undefined, contentHash: undefined }));
  assert.ok(unobservedRows.rows.some((row) => row.stateId === "optional-unseen"
    && row.field === "attributes" && row.verdict === "UNOBSERVED"));
  assert.deepEqual(selectedSeoBranch({ childCapabilityId: "open_gpt_execution_profile",
    stateIds: ["profile-collapsed-trigger", "profile-open"] }, {
    stateBranches: { open_gpt_execution_profile: [["profile-collapsed-trigger", "profile-open"],
      ["profile-already-open"]] } }), ["profile-collapsed-trigger", "profile-open"]);
  assert.equal(selectedSeoBranch({ childCapabilityId: "open_gpt_execution_profile",
    stateIds: ["profile-collapsed-trigger", "profile-open", "profile-already-open"] }, {
    stateBranches: { open_gpt_execution_profile: [["profile-collapsed-trigger", "profile-open"],
      ["profile-already-open"]] } }), null);
  const sourceDrift = structuredClone(first);
  sourceDrift.source.sourceHashes["src/plugins/public-knowledge-article-pipeline/index.ts"] = sha("changed-source");
  sourceDrift.scenes[0].binding.sourceInputHash = digest(sourceDrift.source);
  sourceDrift.scenes[0].stateSignature = sha(JSON.stringify({ url: sourceDrift.scenes[0].url,
    activeTabIdentityHash: sourceDrift.scenes[0].activeTabIdentityHash,
    documentIdentityHash: sourceDrift.scenes[0].documentIdentityHash,
    observationRevisionHash: sourceDrift.scenes[0].observationRevisionHash,
    nodeCount: sourceDrift.scenes[0].nodeCount, nodes: sourceDrift.scenes[0].nodes,
    pageFacts: sourceDrift.scenes[0].pageFacts, binding: sourceDrift.scenes[0].binding,
    decisionReceipt: sourceDrift.scenes[0].decisionReceipt,
    transitionReceipt: sourceDrift.scenes[0].transitionReceipt }));
  assert.throws(() => validateSeoRevision(sealSeoRevision({ ...sourceDrift,
    evidenceRevisionId: undefined, contentHash: undefined })), /SEO_REVISION_FLOW_PLAN_INVALID/u);
  const missingPre = structuredClone(first);
  missingPre.frozenPlan[0].stateIds.unshift("before");
  missingPre.frozenPlan[0].requiredLiveStates.unshift("before");
  missingPre.frozenPlan[0].stateAssertions.before = [];
  missingPre.frozenPlan[0].liveStateTargets.before = ["composer"];
  missingPre.planDigest = digest(missingPre.frozenPlan);
  missingPre.cells.unshift({ childCapabilityId: "prepare_clean_gpt_chat", stateId: "before",
    status: "CAPTURE_GAP", reason: "required-state-not-mapped", observations: [] });
  missingPre.frozenFlow.stateBranches.prepare_clean_gpt_chat = [["before", "pre"]];
  missingPre.flowDigest = digest(missingPre.frozenFlow);
  missingPre.flowGaps = seoFlowGaps(missingPre);
  assert.ok(missingPre.flowGaps.includes("missing-branch-state:corpus_research/prepare_clean_gpt_chat/before"));
  missingPre.captureStatus = "CAPTURE_COMPLETE";
  assert.throws(() => validateSeoRevision(sealSeoRevision({ ...missingPre,
    evidenceRevisionId: undefined, contentHash: undefined })), /SEO_REVISION_COMPLETENESS_INVALID/u);
  assert.throws(() => assertSeoSourceAdmission({ publicSource: first.source }, first.source),
    /SEO_LIVE_SOURCE_NOT_READ_BACK/u);
  const fakeComplete = structuredClone(first);
  fakeComplete.captureStatus = "CAPTURE_COMPLETE";
  assert.throws(() => validateSeoRevision(sealSeoRevision({ ...fakeComplete,
    evidenceRevisionId: undefined, contentHash: undefined })), /SEO_REVISION_COMPLETENESS_INVALID/u);
  const beforeResearchResult = structuredClone(first);
  beforeResearchResult.stageReceipts = [];
  beforeResearchResult.terminalBranch = "unknown-effect";
  beforeResearchResult.terminalReceipt.providerEffect = "unknown";
  assert.equal(validateSeoRevision(sealSeoRevision({ ...beforeResearchResult,
    evidenceRevisionId: undefined, contentHash: undefined })), true);
  const forgedField = structuredClone(first);
  forgedField.cells[0].observations[0].fieldValues.attributes = { "data-testid": "forged" };
  delete forgedField.evidenceRevisionId;
  delete forgedField.contentHash;
  assert.throws(() => validateSeoRevision(sealSeoRevision(forgedField)),
    /SEO_REVISION_FIXED_FIELD_VALUES_INVALID/u);
  const concurrent = await Promise.all([first, second].map((revision) => appendSeoRevision({
    repo, reportPath, comparisonPath, revision })));
  assert.equal(concurrent.filter((result) => result.appended).length, 2);
  const readback = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(readback.seoCaptureRevisions.length, 2);
  assert.equal(validateSeoReportExtension(readback), true);
  assert.equal((await appendSeoRevision({ repo, reportPath, comparisonPath, revision: first })).appended, false);
  const correction = sample("test-run-1", first.evidenceRevisionId);
  await appendSeoRevision({ repo, reportPath, comparisonPath, revision: correction });
  const final = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(final.seoCaptureRevisions.length, 3);
  assert.equal(final.seoCaptureRevisions[0].evidenceRevisionId, first.evidenceRevisionId);
  assert.equal(await readFile(reportPath, "utf8"), `${JSON.stringify(final)}\n`);
  assert.deepEqual((await readSeoReport(reportPath)).seoCaptureRevisions.map((entry) =>
    entry.evidenceRevisionId), final.seoCaptureRevisions.map((entry) => entry.evidenceRevisionId));
  const malformedPath = join(folder, "malformed-report.json");
  await writeFile(malformedPath, (await readFile(reportPath, "utf8")).slice(0, -2));
  await assert.rejects(readSeoReport(malformedPath), /SEO_REPORT_STREAM_SUFFIX_INVALID/u);
  await writeFile(malformedPath, `${await readFile(reportPath, "utf8")}\u00a0`);
  await assert.rejects(readSeoReport(malformedPath), /SEO_REPORT_STREAM_SUFFIX_INVALID/u);
  const tampered = structuredClone(final);
  tampered.seoCaptureRevisions[0].source.archiveHash = sha("tampered");
  assert.throws(() => validateSeoReportExtension(tampered), /SEO_REVISION_(?:HASH|SCENE)_INVALID/u);
  assert.match(await readFile(comparisonPath, "utf8"), /comparisonId|sha256:/u);
  process.stdout.write("seo-report-revisions-acceptance-ok\n");
}

main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
