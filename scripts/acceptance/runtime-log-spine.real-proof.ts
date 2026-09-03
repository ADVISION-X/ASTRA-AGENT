if (!String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-RUNTIME-LOG-SPINE-001-V6:dynamic.browser": {"claims": {"summary": [{"path": "/facts/runtime_log_browser_span_count", "operator": "gte", "expected": 39}]}},
    "LAW-RUNTIME-LOG-SPINE-001-V6:dynamic.service": {"claims": {"summary": [{"path": "/facts/runtime_log_event_count", "operator": "gte", "expected": 39}, {"path": "/facts/runtime_log_integrity_valid", "operator": "equals", "expected": true}]}},
    "LAW-RUNTIME-LOG-SPINE-001-V6:dynamic.storage": {"claims": {"forbidden:3": [{"path": "/facts/runtime_log_authority_hash_count", "operator": "gte", "expected": 39}, {"path": "/facts/runtime_log_forbidden_task_state_field_count", "operator": "equals", "expected": 0}]}},
    "LAW-RUNTIME-LOG-SPINE-001-V6:dynamic.recovery": {"claims": {"summary": [{"path": "/facts/runtime_log_forbidden_task_state_field_count", "operator": "equals", "expected": 0}]}},
    "LAW-RUNTIME-LOG-SPINE-002-V4:dynamic.browser": {"claims": {"forbidden:0": [{"path": "/facts/persisted_sensitive_value_count", "operator": "equals", "expected": 0}]}},
    "LAW-RUNTIME-LOG-SPINE-002-V4:dynamic.storage": {"claims": {"forbidden:0": [{"path": "/facts/runtime_log_sensitive_value_count", "operator": "equals", "expected": 0}]}},
    "LAW-RUNTIME-LOG-SPINE-003-V6:dynamic.browser": {"claims": {"forbidden:4": [{"path": "/facts/runtime_log_mutation_event_count", "operator": "gte", "expected": 39}, {"path": "/facts/runtime_log_forbidden_task_state_field_count", "operator": "equals", "expected": 0}]}},
    "LAW-RUNTIME-LOG-SPINE-003-V6:dynamic.service": {"claims": {"forbidden:3": [{"path": "/facts/runtime_log_integrity_valid", "operator": "equals", "expected": true}, {"path": "/facts/runtime_log_open_span_count", "operator": "equals", "expected": 0}, {"path": "/facts/runtime_log_producer_count", "operator": "equals", "expected": 1}, {"path": "/facts/runtime_log_sealed", "operator": "equals", "expected": true}]}},
    "LAW-RUNTIME-LOG-SPINE-003-V6:dynamic.storage": {"claims": {"forbidden:4": [{"path": "/facts/runtime_log_authority_hash_count", "operator": "gte", "expected": 39}, {"path": "/facts/runtime_log_forbidden_task_state_field_count", "operator": "equals", "expected": 0}]}},
    "LAW-RUNTIME-LOG-SPINE-003-V6:dynamic.recovery": {"claims": {"summary": [{"path": "/facts/runtime_log_forbidden_task_state_field_count", "operator": "equals", "expected": 0}]}}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END")) {
  throw new Error("RUNTIME_LOG_DYNAMIC_CLAIM_CONTRACT_INVALID");
}
throw new Error("RUNTIME_LOG_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
