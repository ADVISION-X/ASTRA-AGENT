import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  completeGptPageEvidenceCaptureFailures,
  gptPageEvidencePrivacyFailures,
} from "../audit/domains/gpt/gpt-page-evidence-capture-inspection.js";

const report = JSON.parse(readFileSync(resolve(
  "docs/项目方案/GPT页面操作子能力实证资料.json",
), "utf8")) as { children: Array<Record<string, unknown>> };
const baseline = report.children.find((child) =>
  child.childCapabilityId === "select_exact_gpt_model_v2")!;
const demand = baseline.evidenceDemand as Record<string, unknown>;

assert.deepEqual(completeGptPageEvidenceCaptureFailures(baseline, demand), []);

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

process.stdout.write("gpt-page-evidence-closure-acceptance-ok\n");
