if (!String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-LOCAL-BROWSER-SESSION-001-V4:dynamic.browser": {"claims": {"forbidden:6": [{"path": "/facts/extension_worker_count", "operator": "equals", "expected": 1}, {"path": "/facts/authority_present", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-002-V6:dynamic.browser": {"claims": {"forbidden:8": [{"path": "/facts/release_build_matches_record", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-003-V25:dynamic.browser": {"claims": {"forbidden:15": [{"path": "/facts/target_claimed_observed", "operator": "equals", "expected": true}, {"path": "/facts/system_chatgpt_page_observed", "operator": "equals", "expected": true}, {"path": "/facts/settled_system_chatgpt_tab_count", "operator": "equals", "expected": 1}, {"path": "/facts/unique_system_target_ref_count", "operator": "equals", "expected": 1}, {"path": "/facts/five_job_unique_browser_slot_count", "operator": "equals", "expected": 5}, {"path": "/facts/five_job_page_child_count", "operator": "gte", "expected": 5}, {"path": "/facts/five_job_normal_park_count", "operator": "gte", "expected": 5}, {"path": "/facts/five_job_reacquire_count", "operator": "gte", "expected": 5}, {"path": "/facts/five_job_page_switch_fact_count", "operator": "gte", "expected": 5}, {"path": "/facts/five_job_starvation_count", "operator": "equals", "expected": 0}, {"path": "/facts/final_active_claim_absent", "operator": "equals", "expected": true}, {"path": "/facts/operator_page_unchanged", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-004-V26:dynamic.browser": {"claims": {"forbidden:12": [{"path": "/facts/coherent_observation_packet_count", "operator": "gte", "expected": 39}], "forbidden:13": [{"path": "/facts/true_connected_fact_count", "operator": "gte", "expected": 1}], "forbidden:14": [{"path": "/facts/extension_revalidation_count", "operator": "gte", "expected": 1}, {"path": "/facts/physical_input_over_one_count", "operator": "equals", "expected": 0}, {"path": "/facts/coherent_pointer_action_count", "operator": "gte", "expected": 1}]}},
    "LAW-LOCAL-BROWSER-SESSION-004-V26:dynamic.storage": {"claims": {"forbidden:16": [{"path": "/facts/mutation_rows_complete", "operator": "equals", "expected": true}, {"path": "/facts/mutation_terminal_fact_invalid_count", "operator": "equals", "expected": 0}, {"path": "/facts/actionability_native_cause_persisted", "operator": "equals", "expected": true}, {"path": "/facts/sqlite_wal_mode", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-005-V6:dynamic.browser": {"claims": {"forbidden:5": [{"path": "/facts/release_build_matches_record", "operator": "equals", "expected": true}]}},
    "LAW-LOCAL-BROWSER-SESSION-006-V18:dynamic.browser": {"claims": {"forbidden:0": [{"path": "/facts/persisted_sensitive_value_count", "operator": "equals", "expected": 0}]}}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END")) {
  throw new Error("LOCAL_BROWSER_DYNAMIC_CLAIM_CONTRACT_INVALID");
}
throw new Error("LOCAL_BROWSER_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
