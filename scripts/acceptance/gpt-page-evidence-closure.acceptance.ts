import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  completeGptPageEvidenceCaptureFailures,
  gptPageEvidencePrivacyFailures,
  scopedGptPageEvidenceFactFailures,
} from "../audit/domains/gpt/gpt-page-evidence-capture-inspection.js";

const report = JSON.parse(readFileSync(resolve(
  "docs/项目方案/GPT页面操作子能力实证资料.json",
), "utf8")) as { children: Array<Record<string, unknown>> };
const baseline = report.children.find((child) =>
  child.childCapabilityId === "select_exact_gpt_model_v2")!;
const demand = baseline.evidenceDemand as Record<string, unknown>;

assert.deepEqual(completeGptPageEvidenceCaptureFailures(baseline, demand), []);

const mergedRuns = report.children.find((child) =>
  child.childCapabilityId === "reconcile_gpt_attachment_set")!;
const mergedRunsDemand = mergedRuns.evidenceDemand as Record<string, unknown>;
assert.deepEqual(completeGptPageEvidenceCaptureFailures(mergedRuns, mergedRunsDemand), []);

const wrongSceneRun = structuredClone(mergedRuns);
const wrongSceneRunCollection = wrongSceneRun.collection as {
  captureContext: { sceneManifest: Array<Record<string, unknown>> };
};
const wrongRunScene = wrongSceneRunCollection.captureContext.sceneManifest[0]!;
(wrongRunScene.binding as { runId: string }).runId = "wrong-run";
assert.ok(completeGptPageEvidenceCaptureFailures(wrongSceneRun, mergedRunsDemand)
  .includes("scene-binding:attachment-cards-ready"));

const wrongSceneTab = structuredClone(mergedRuns);
const wrongSceneTabCollection = wrongSceneTab.collection as {
  captureContext: { sceneManifest: Array<Record<string, unknown>> };
};
const wrongTabScene = wrongSceneTabCollection.captureContext.sceneManifest[0]!;
(wrongTabScene.binding as { qaTabIdentityHash: string }).qaTabIdentityHash = "sha256:"
  + "0".repeat(64);
assert.ok(completeGptPageEvidenceCaptureFailures(wrongSceneTab, mergedRunsDemand)
  .includes("scene-binding:attachment-cards-ready"));

const missingBinding = structuredClone(baseline);
(missingBinding.collection as { factBindings: unknown[] }).factBindings.pop();
assert.ok(completeGptPageEvidenceCaptureFailures(missingBinding, demand).includes("fact-binding-set"));

const falseTarget = structuredClone(baseline);
const falseTargetCollection = falseTarget.collection as {
  factBindings: Array<{ factId: string; observationId: string }>;
  specimens: Array<Record<string, unknown>>;
};
const targetBinding = falseTargetCollection.factBindings.find((binding) =>
  binding.factId === "target:model-option")!;
const targetSpecimen = falseTargetCollection.specimens.find((specimen) =>
  specimen.observationId === targetBinding.observationId)!;
((targetSpecimen.core as { targets: Record<string, { observed: boolean }> }).targets["model-option"]!).observed = false;
assert.ok(completeGptPageEvidenceCaptureFailures(falseTarget, demand).some((failure) =>
  failure === "binding-target:model-option"));

const duplicateSignature = structuredClone(baseline);
const live = (duplicateSignature.collection as { specimens: Array<Record<string, unknown>> }).specimens
  .filter((specimen) => specimen.evidenceKind === "LIVE_PAGE");
live[1]!.stateSignature = live[0]!.stateSignature;
assert.ok(completeGptPageEvidenceCaptureFailures(duplicateSignature, demand).includes("live-signatures"));

assert.ok(gptPageEvidencePrivacyFailures({ url: "/c/raw-conversation-id" }).length > 0);
assert.ok(gptPageEvidencePrivacyFailures({ accessToken: "forbidden" }).length > 0);

const partial = report.children.find((child) =>
  child.childCapabilityId === "wait_for_stable_gpt_text")!;
const partialDemand = partial.evidenceDemand as Record<string, unknown>;
assert.deepEqual(scopedGptPageEvidenceFactFailures(
  partial, partialDemand, ["target:assistant-turn", "live-state:text-stable"],
), []);
assert.ok(scopedGptPageEvidenceFactFailures(
  partial, partialDemand, ["live-state:generation-error"],
).includes("fact-not-observed:live-state:generation-error"));
assert.ok(scopedGptPageEvidenceFactFailures(
  partial, partialDemand, ["target:not-declared"],
).includes("fact-not-declared:target:not-declared"));

const scopedFalseTarget = structuredClone(partial);
const scopedCollection = scopedFalseTarget.collection as {
  factBindings: Array<{ factId: string; observationId: string }>;
  specimens: Array<Record<string, unknown>>;
};
const scopedTargetBinding = scopedCollection.factBindings.find((binding) =>
  binding.factId === "target:assistant-turn")!;
const scopedTargetSpecimen = scopedCollection.specimens.find((specimen) =>
  specimen.observationId === scopedTargetBinding.observationId)!;
((scopedTargetSpecimen.core as { targets: Record<string, { observed: boolean }> })
  .targets["assistant-turn"]!).observed = false;
assert.ok(scopedGptPageEvidenceFactFailures(
  scopedFalseTarget, partialDemand, ["target:assistant-turn"],
).includes("binding-target:assistant-turn"));

process.stdout.write("gpt-page-evidence-closure-acceptance-ok\n");
