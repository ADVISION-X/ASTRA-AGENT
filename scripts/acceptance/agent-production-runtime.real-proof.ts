void String.raw`
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */
{
  "schema_version": "producer-dynamic-claim-contract.v1",
  "routes": {
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V77:dynamic.service": {
      "claims": {
        "summary": [
          {
            "path": "/facts/cleanup_verified",
            "operator": "equals",
            "expected": true
          },
          {
            "path": "/facts/workbench_stopped",
            "operator": "equals",
            "expected": true
          },
          {
            "path": "/facts/gate_a_through_e_completed",
            "operator": "equals",
            "expected": true
          },
          {
            "path": "/facts/gate_a_n1_baseline_completed",
            "operator": "equals",
            "expected": true
          },
          {
            "path": "/facts/gate_a_n1_regression_invalid_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/gate_a_n1_new_claim_before_admission_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/gate_a_n1_physical_submit_over_one_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/gate_b_n2_canary_completed",
            "operator": "equals",
            "expected": true
          },
          {
            "path": "/facts/gate_b_n2_post_submit_40s_page_command_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/gate_b_n2_cross_job_close_impact_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/exact_candidate_binding_valid",
            "operator": "equals",
            "expected": true
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V77:dynamic.database": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/frozen_identity_invalid_count",
            "operator": "equals",
            "expected": 0
          }
        ],
        "forbidden:2": [
          {
            "path": "/facts/unscheduled_outbox_count",
            "operator": "equals",
            "expected": 0
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V77:dynamic.storage": {
      "claims": {
        "forbidden:2": [
          {
            "path": "/facts/proof_job_pending_outbox_count",
            "operator": "equals",
            "expected": 0
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V12:dynamic.service": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/control_contract_version_exact",
            "operator": "equals",
            "expected": true
          }
        ],
        "summary": [
          {
            "path": "/facts/cleanup_verified",
            "operator": "equals",
            "expected": true
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V12:dynamic.authorization": {
      "claims": {
        "forbidden:1": [
          {
            "path": "/facts/unbound_lease_fence_job_count",
            "operator": "equals",
            "expected": 0
          }
        ],
        "forbidden:2": [
          {
            "path": "/authorityState",
            "operator": "equals",
            "expected": "present"
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V45:dynamic.service": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/business_admission_receipt_invalid_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/device_capacity_grant_overflow_count",
            "operator": "equals",
            "expected": 0
          }
        ],
        "forbidden:1": [
          {
            "path": "/facts/runtime_completion_without_admission_count",
            "operator": "equals",
            "expected": 0
          },
          {
            "path": "/facts/tab_release_before_website_terminal_count",
            "operator": "equals",
            "expected": 0
          }
        ],
        "summary": [
          {
            "path": "/facts/business_admission_completed_count",
            "operator": "gte",
            "expected": 36
          },
          {
            "path": "/facts/n3_throughput_gain_percent",
            "operator": "gte",
            "expected": 20
          },
          {
            "path": "/facts/n3_success_rate_not_lower",
            "operator": "equals",
            "expected": true
          },
          {
            "path": "/facts/dynamic_resize_3_4_3_verified",
            "operator": "equals",
            "expected": true
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V43:dynamic.database": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/runtime_schema_exact",
            "operator": "equals",
            "expected": true
          }
        ],
        "summary": [
          {
            "path": "/facts/runtime_schema_exact",
            "operator": "equals",
            "expected": true
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V47:dynamic.storage": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/runtime_orphan_directory_count",
            "operator": "equals",
            "expected": 0
          }
        ],
        "forbidden:1": [
          {
            "path": "/facts/proof_job_pending_outbox_count",
            "operator": "equals",
            "expected": 0
          }
        ],
        "summary": [
          {
            "path": "/facts/runtime_orphan_directory_count",
            "operator": "equals",
            "expected": 0
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V48:dynamic.service": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/runtime_claims_business_completion",
            "operator": "equals",
            "expected": false
          }
        ],
        "summary": [
          {
            "path": "/facts/cleanup_verified",
            "operator": "equals",
            "expected": true
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V48:dynamic.database": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/runtime_schema_exact",
            "operator": "equals",
            "expected": true
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V48:dynamic.storage": {
      "claims": {
        "forbidden:0": [
          {
            "path": "/facts/runtime_orphan_directory_count",
            "operator": "equals",
            "expected": 0
          }
        ]
      }
    },
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V48:dynamic.authorization": {
      "claims": {
        "forbidden:1": [
          {
            "path": "/facts/unbound_lease_fence_job_count",
            "operator": "equals",
            "expected": 0
          }
        ]
      }
    }
  }
}
/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */`;

// Dynamic routes remain fail-closed until Runtime has its independently admitted proof.
throw new Error("AGENT_RUNTIME_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED");
