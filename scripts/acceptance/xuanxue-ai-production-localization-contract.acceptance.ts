import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS,
  assertXuanxueLocalizationContract,
  expectedLocalizationProviderProfile,
  isExactXuanxueLocalizationProductContractMap,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import {
  resolveXuanxueAiProductionProfile,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.js";

const expected = [
  ["localization_report_translation", "report_translation"],
  ["localization_article_translation", "article_translation"],
  ["localization_static_review_candidate", "localization_candidate"],
  ["localization_static_review_selector", "localization_selector"],
] as const;

for (const [product, stage] of expected) {
  const profile = resolveXuanxueAiProductionProfile(product);
  assert.equal(profile.stages.length, 1, `${product} must be one stage`);
  assert.equal(profile.stages[0]?.stageId, stage);
  assert.equal(profile.finalStageId, stage);
}

assert.equal(
  expectedLocalizationProviderProfile("candidate_a").reasoning_effort,
  "xhigh",
);
for (const role of [
  "candidate_b", "selector_first", "selector_swap", "consistency",
  "report_translation", "article_translation",
] as const) {
  assert.equal(expectedLocalizationProviderProfile(role).reasoning_effort, "high");
}

const projection = JSON.parse(readFileSync(
  path.resolve("artifacts/contracts/localization-production-contract.v1.json"),
  "utf8",
)) as { contract_manifest_hash: string; products: Record<string, string> };
assert.equal(
  projection.contract_manifest_hash,
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
);
for (const [productId, contract] of Object.entries(XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS)) {
  assert.equal(projection.products[productId], contract.product_contract_hash);
}
assert.equal(
  isExactXuanxueLocalizationProductContractMap(Object.fromEntries(
    Object.entries(projection.products).reverse(),
  )),
  true,
  "JSON object field order must not change localization contract identity",
);

const candidateContract = XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS.localization_static_review_candidate;
assert.doesNotThrow(() => assertXuanxueLocalizationContract({
  productId: "localization_static_review_candidate",
  stageId: candidateContract.stage_id,
  triggerKind: candidateContract.trigger_kind,
  contractManifestHash: XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  productContractHash: candidateContract.product_contract_hash,
  role: "candidate_a",
  providerProfile: expectedLocalizationProviderProfile("candidate_a"),
  inputKinds: candidateContract.required_input_kinds,
  hasConversationParent: false,
}));
assert.throws(() => assertXuanxueLocalizationContract({
  productId: "localization_static_review_candidate",
  stageId: candidateContract.stage_id,
  triggerKind: candidateContract.trigger_kind,
  contractManifestHash: XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  productContractHash: candidateContract.product_contract_hash,
  role: "candidate_a",
  providerProfile: expectedLocalizationProviderProfile("candidate_a"),
  inputKinds: candidateContract.required_input_kinds,
  hasConversationParent: true,
}), /XUANXUE_AI_PRODUCTION_LOCALIZATION_CONVERSATION_PARENT_INVALID/u);

process.stdout.write(
  "[ACCEPTANCE] localization contract definition PASS: four single-stage products, seven frozen roles, claim isolation, profile-driven feed and evidence gates are declared.\n",
);
