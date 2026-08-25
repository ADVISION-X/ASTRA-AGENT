import assert from "node:assert/strict";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS,
  assertXuanxueLocalizationContract,
  expectedLocalizationProviderProfile,
  isExactXuanxueLocalizationProductContractMap,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import { resolveXuanxueAiProductionProfile } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.js";
import {
  XUANXUE_PRODUCT_EXECUTION_PROVIDER_COMMIT,
  xuanxueLocalOrderNode,
  xuanxueProductExecutionContract,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-product-contracts.js";

const expected = [
  ["localization_report_translation", "report_translation"],
  ["localization_article_translation", "article_translation"],
  ["localization_static_review_candidate", "candidate_a"],
  ["localization_static_review_candidate", "candidate_b"],
  ["localization_static_review_selector", "selector_first"],
  ["localization_static_review_selector", "selector_swap"],
  ["localization_static_review_selector", "consistency"],
] as const;

for (const [product, stage] of expected) {
  const profile = resolveXuanxueAiProductionProfile(product, [stage]);
  assert.equal(profile.stages.length, 1, `${product}/${stage} must be one local stage`);
  assert.equal(profile.stages[0]?.stageId, stage);
  assert.equal(profile.finalStageId, stage);
  assert.equal(profile.nodeId, stage);
}

assert.equal(XUANXUE_PRODUCT_EXECUTION_PROVIDER_COMMIT.length, 40);
assert.equal(expectedLocalizationProviderProfile("candidate_a").reasoning_effort, "xhigh");
for (const role of [
  "candidate_b", "selector_first", "selector_swap", "consistency",
  "report_translation", "article_translation",
] as const) {
  assert.equal(expectedLocalizationProviderProfile(role).reasoning_effort, "high");
}

assert.equal(
  isExactXuanxueLocalizationProductContractMap(
    Object.fromEntries(Object.entries(XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS)
      .map(([productId, contract]) => [productId, contract.product_contract_hash])
      .reverse()),
  ),
  true,
);

const candidate = xuanxueProductExecutionContract(
  "localization_static_review_candidate",
);
const candidateNode = xuanxueLocalOrderNode(
  candidate.contract_id,
  ["candidate_a"],
);
assert.equal(candidateNode.order_contract.stages[0]?.stage_id, "candidate_a");
const candidateInputs = ["localization_review_context_json"] as const;
const candidateInput = {
  productId: candidate.contract_id,
  stageId: "candidate_a",
  triggerKind: "localization_static_review",
  contractManifestHash: XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  productContractHash: candidate.product_contract_hash,
  role: "candidate_a",
  providerProfile: expectedLocalizationProviderProfile("candidate_a"),
  inputKinds: candidateInputs,
  hasConversationParent: false,
} as const;
assert.doesNotThrow(() => assertXuanxueLocalizationContract(candidateInput));
assert.throws(() => assertXuanxueLocalizationContract({
  ...candidateInput,
  productContractHash: `sha256:${"0".repeat(64)}`,
}), /XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_IDENTITY_INVALID/u);
assert.throws(() => assertXuanxueLocalizationContract({
  ...candidateInput,
  hasConversationParent: true,
}), /XUANXUE_AI_PRODUCTION_LOCALIZATION_CONVERSATION_PARENT_INVALID/u);

process.stdout.write(
  "[ACCEPTANCE] localization generated projection PASS: four products, seven role-bound local orders, exact hashes and no parallel topology.\n",
);
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V3", evidenceMode: "exam.golden", locator: "acceptance:xuanxue-localization:contract-projection", observedValue: "four products seven role-bound local orders exact hashes and no parallel topology" });
