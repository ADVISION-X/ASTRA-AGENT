if (!String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V46:dynamic.service": {"claims": {"summary": [{"path": "/facts/cleanup_verified", "operator": "equals", "expected": true}, {"path": "/facts/workbench_stopped", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V46:dynamic.database": {"claims": {"forbidden:0": [{"path": "/facts/frozen_identity_invalid_count", "operator": "equals", "expected": 0}], "forbidden:2": [{"path": "/facts/unscheduled_outbox_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V46:dynamic.storage": {"claims": {"forbidden:2": [{"path": "/facts/proof_job_pending_outbox_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V46:dynamic.recovery": {"claims": {"forbidden:1": [{"path": "/facts/same_attempt_after_restart", "operator": "equals", "expected": true}], "forbidden:3": [{"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V3:dynamic.service": {"claims": {"forbidden:0": [{"path": "/facts/control_contract_version_exact", "operator": "equals", "expected": true}], "summary": [{"path": "/facts/cleanup_verified", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V3:dynamic.authorization": {"claims": {"forbidden:1": [{"path": "/facts/unbound_lease_fence_job_count", "operator": "equals", "expected": 0}], "forbidden:2": [{"path": "/authorityState", "operator": "equals", "expected": "present"}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V16:dynamic.service": {"claims": {"forbidden:0": [{"path": "/facts/business_admission_receipt_invalid_count", "operator": "equals", "expected": 0}], "forbidden:1": [{"path": "/facts/runtime_completion_without_admission_count", "operator": "equals", "expected": 0}], "summary": [{"path": "/facts/business_admission_completed_count", "operator": "gte", "expected": 5}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V14:dynamic.database": {"claims": {"forbidden:0": [{"path": "/facts/runtime_schema_exact", "operator": "equals", "expected": true}], "summary": [{"path": "/facts/runtime_schema_exact", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V14:dynamic.recovery": {"claims": {"forbidden:1": [{"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V16:dynamic.storage": {"claims": {"forbidden:0": [{"path": "/facts/runtime_orphan_directory_count", "operator": "equals", "expected": 0}], "forbidden:1": [{"path": "/facts/proof_job_pending_outbox_count", "operator": "equals", "expected": 0}], "summary": [{"path": "/facts/runtime_orphan_directory_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V16:dynamic.recovery": {"claims": {"forbidden:2": [{"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V17:dynamic.service": {"claims": {"forbidden:0": [{"path": "/facts/runtime_claims_business_completion", "operator": "equals", "expected": false}], "summary": [{"path": "/facts/cleanup_verified", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V17:dynamic.database": {"claims": {"forbidden:0": [{"path": "/facts/runtime_schema_exact", "operator": "equals", "expected": true}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V17:dynamic.storage": {"claims": {"forbidden:0": [{"path": "/facts/runtime_orphan_directory_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V17:dynamic.authorization": {"claims": {"forbidden:1": [{"path": "/facts/unbound_lease_fence_job_count", "operator": "equals", "expected": 0}]}},
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V17:dynamic.recovery": {"claims": {"forbidden:2": [{"path": "/unresolvedCount", "operator": "equals", "expected": 0}]}}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END")) {
  throw new Error("AGENT_RUNTIME_DYNAMIC_CLAIM_CONTRACT_INVALID");
}
throw new Error("AGENT_RUNTIME_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
