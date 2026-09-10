if (!String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-GPT-001-V41:dynamic.browser": {"claims": {
      "forbidden:2": [{"path": "/facts/submit_confirmed_count", "operator": "equals", "expected": 1}],
      "forbidden:3": [{"path": "/facts/result_checkpoint_count", "operator": "equals", "expected": 1}],
      "forbidden:5": [{"path": "/facts/fresh_current_document", "operator": "equals", "expected": true}],
      "forbidden:6": [{"path": "/facts/browser_wal_terminal_count", "operator": "gte", "expected": 1}, {"path": "/facts/provider_replay_count", "operator": "equals", "expected": 0}]
    }},
    "LAW-GPT-001-V41:dynamic.storage": {"claims": {
      "forbidden:1": [{"path": "/facts/child_evidence_record_count", "operator": "equals", "expected": 0}],
      "forbidden:3": [{"path": "/facts/raw_answer_artifact_count", "operator": "equals", "expected": 1}, {"path": "/facts/raw_answer_artifact_readback", "operator": "equals", "expected": true}],
      "forbidden:4": [{"path": "/facts/persisted_wait_position_count", "operator": "equals", "expected": 0}]
    }},
    "LAW-GPT-001-V41:dynamic.provider": {"claims": {
      "forbidden:0": [{"path": "/facts/provider_count", "operator": "equals", "expected": 1}],
      "forbidden:7": [{"path": "/facts/ended_attempt_replay_count", "operator": "equals", "expected": 0}]
    }}
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END")) {
  throw new Error("GPT_DYNAMIC_CLAIM_CONTRACT_INVALID");
}
throw new Error("GPT_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
