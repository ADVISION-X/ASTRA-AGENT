if (!String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-GPT-001-V21:dynamic.browser": {"claims": {"forbidden:6": [{"path": "/facts/exact_target_document_binding_count", "operator": "gte", "expected": 39}, {"path": "/facts/operator_page_unchanged", "operator": "equals", "expected": true}]}},
    "LAW-GPT-001-V21:dynamic.storage": {"claims": {"forbidden:16": [{"path": "/facts/continuation_transaction_row_count", "operator": "gte", "expected": 1}, {"path": "/facts/continuation_transaction_invalid_count", "operator": "equals", "expected": 0}, {"path": "/facts/continuation_lane_owner_count", "operator": "equals", "expected": 0}]}},
    "LAW-GPT-001-V21:dynamic.provider": {"claims": {"forbidden:1": [{"path": "/facts/provider_count", "operator": "equals", "expected": 1}]}},
    "LAW-GPT-001-V21:dynamic.authorization": {"claims": {"forbidden:2": [{"path": "/facts/exact_target_document_binding_count", "operator": "gte", "expected": 39}]}},
    "LAW-GPT-001-V21:dynamic.recovery": {"claims": {"forbidden:15": [{"path": "/facts/failed_observed", "operator": "equals", "expected": true}, {"path": "/facts/completed_observed", "operator": "equals", "expected": true}, {"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END")) {
  throw new Error("GPT_DYNAMIC_CLAIM_CONTRACT_INVALID");
}
throw new Error("GPT_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
