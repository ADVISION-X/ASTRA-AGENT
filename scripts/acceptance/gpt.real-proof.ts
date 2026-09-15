if (!String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-GPT-001-V53:dynamic.browser": {"claims": {
      "forbidden:3": [{"path": "/facts/submit_confirmed_count", "operator": "equals", "expected": 1}],
      "forbidden:4": [{"path": "/facts/result_checkpoint_count", "operator": "equals", "expected": 1}],
      "forbidden:5": [{"path": "/facts/normal_poll_park_count", "operator": "gte", "expected": 1}, {"path": "/facts/normal_poll_reacquire_count", "operator": "gte", "expected": 1}, {"path": "/facts/normal_poll_page_navigate_count", "operator": "equals", "expected": 0}, {"path": "/facts/gate_a_n1_normal_poll_page_navigate_count", "operator": "equals", "expected": 0}, {"path": "/facts/gate_b_n2_post_submit_40s_page_command_count", "operator": "equals", "expected": 0}, {"path": "/facts/provider_observation_unpaced_count", "operator": "equals", "expected": 0}, {"path": "/facts/provider_observation_minimum_gap_ms", "operator": "gte", "expected": 60000}],
      "forbidden:6": [{"path": "/facts/fresh_current_document", "operator": "equals", "expected": true}],
      "forbidden:7": [{"path": "/facts/settled_conversation_rename_four_input_success_count", "operator": "gte", "expected": 1}, {"path": "/facts/settled_conversation_rename_zero_input_success_count", "operator": "gte", "expected": 1}, {"path": "/facts/settled_conversation_rename_failure_matrix_complete", "operator": "equals", "expected": true}, {"path": "/facts/settled_conversation_rename_budget_skip_observed", "operator": "equals", "expected": true}, {"path": "/facts/settled_conversation_rename_park_after_every_outcome", "operator": "equals", "expected": true}, {"path": "/facts/settled_conversation_rename_next_job_progress_after_failure", "operator": "equals", "expected": true}, {"path": "/facts/settled_conversation_rename_blocking_failure_count", "operator": "equals", "expected": 0}, {"path": "/facts/settled_conversation_rename_provider_input_count", "operator": "equals", "expected": 0}],
      "forbidden:8": [{"path": "/facts/browser_wal_terminal_count", "operator": "gte", "expected": 1}, {"path": "/facts/provider_replay_count", "operator": "equals", "expected": 0}]
    }},
    "LAW-GPT-001-V53:dynamic.storage": {"claims": {
      "forbidden:4": [{"path": "/facts/raw_answer_artifact_count", "operator": "equals", "expected": 1}, {"path": "/facts/raw_answer_artifact_readback", "operator": "equals", "expected": true}],
      "forbidden:7": [{"path": "/facts/settled_conversation_rename_pending_count", "operator": "equals", "expected": 0}, {"path": "/facts/settled_conversation_rename_second_store_count", "operator": "equals", "expected": 0}, {"path": "/facts/settled_conversation_rename_result_hash_unchanged", "operator": "equals", "expected": true}, {"path": "/facts/settled_conversation_rename_outbox_delta", "operator": "equals", "expected": 0}],
      "forbidden:8": [{"path": "/facts/persisted_wait_position_count", "operator": "equals", "expected": 0}]
    }},
    "LAW-GPT-001-V53:dynamic.provider": {"claims": {
      "forbidden:0": [{"path": "/facts/provider_count", "operator": "equals", "expected": 1}, {"path": "/facts/provider_warning_count", "operator": "equals", "expected": 0}, {"path": "/facts/gate_a_n1_provider_warning_count", "operator": "equals", "expected": 0}, {"path": "/facts/gate_a_n1_warning_coverage_complete", "operator": "equals", "expected": true}, {"path": "/facts/gate_b_n2_provider_warning_count", "operator": "equals", "expected": 0}, {"path": "/facts/gate_b_n2_warning_coverage_complete", "operator": "equals", "expected": true}, {"path": "/facts/provider_warning_coverage_complete", "operator": "equals", "expected": true}],
      "forbidden:3": [{"path": "/facts/physical_submit_count", "operator": "equals", "expected": 1}],
      "forbidden:7": [{"path": "/facts/settled_conversation_rename_provider_input_count", "operator": "equals", "expected": 0}],
      "forbidden:8": [{"path": "/facts/ended_attempt_replay_count", "operator": "equals", "expected": 0}]
    }}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END")) {
  throw new Error("GPT_DYNAMIC_CLAIM_CONTRACT_INVALID");
}
throw new Error("GPT_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
