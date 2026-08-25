import assert from "node:assert/strict";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { assertXuanxueLocalizationContract } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import { resolveXuanxueAiProductionProfile } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.js";
import { fixtureHash } from "./xuanxue-ai-production-fixture-provider-profile.js";

const order = {
  productId: "localization_static_review_candidate",
  productContractHash: fixtureHash("fixture:product-contract:localization_static_review_candidate"),
  materials: [{ stageId: "candidate_a" }],
} as const;
const profile = resolveXuanxueAiProductionProfile(order);
assert.equal(profile.stages.length, 1);
assert.equal(profile.finalStageId, "candidate_a");

const candidateInput = {
  contractManifestHash: fixtureHash("fixture:localization-contract-manifest"),
  productContractHash: order.productContractHash,
  role: "candidate_a",
  providerProfile: {
    profile_ref: "fixture:localization:candidate_a",
    profile_hash: fixtureHash("fixture:localization:candidate_a"),
    provider: "gpt-web-chat" as const,
    transport: "web-chat" as const,
    account_capability_ref: "agent:gpt-web-chat:localization" as const,
    model_label: "GPT-5.6 Sol" as const,
    model_family: "gpt-5.6" as const,
    model_identity_status: "verified" as const,
    reasoning_effort: "xhigh" as const,
    executor_identity_ref: "supervised_local_gpt_web" as const,
    ai_acceptance_ref: "APEX-AI-ACCEPTANCE-001-V5" as const,
    ai_acceptance_version: "5.2" as const,
  },
  inputKinds: ["localization_review_context_json"],
} as const;
assert.doesNotThrow(() => assertXuanxueLocalizationContract(candidateInput));
assert.throws(() => assertXuanxueLocalizationContract({
  ...candidateInput,
  contractManifestHash: null,
}), /XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_INVALID/u);
assert.throws(() => assertXuanxueLocalizationContract({
  ...candidateInput,
  inputKinds: [],
}), /XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_INVALID/u);

process.stdout.write(
  "[ACCEPTANCE] localization immutable Cloud order PASS: role, contract identity and local Stage are structurally validated without a provider projection copy.\n",
);
emitQualityProofObservation({ lawId: "LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V5", evidenceMode: "exam.golden", locator: "acceptance:xuanxue-localization:cloud-order", observedValue: "authenticated localization order identity and local stage validated without provider projection copy" });
