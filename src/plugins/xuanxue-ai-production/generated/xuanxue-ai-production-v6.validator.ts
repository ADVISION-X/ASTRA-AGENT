// GENERATED FILE. DO NOT EDIT.
// Provider: ADVISION-X/xuanxue-web@8c06df7747bd5ed23fad869ed424dcb7185fee6a:packages/ai-contracts/src/production-control/v6-contract.ts
// Provider source SHA256: 3b8665f1f9eb8b0d8b8d751faf805077736cf608f27d666ac13fff9d22386d6a
import { createHash } from "node:crypto";

const canonicalForGeneratedHash = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalForGeneratedHash);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalForGeneratedHash(record[key])]));
  }
  return value;
};
const hashCanonicalJson = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalForGeneratedHash(value))).digest("hex")}`;
const productExecutionBundle = {
  "schema_version": 1,
  "contract_id": "ai-acceptance.product-execution-contract",
  "contract_version": 1,
  "canonical_owner": "ai-acceptance",
  "canonical_schema_version": "canonical-json-nfc-v2",
  "contract_count": 20,
  "contracts": [
    {
      "schema_version": 1,
      "contract_id": "bazi_chart_interpretation",
      "product_id": "bazi_chart_interpretation",
      "owner_domain": "bazi",
      "trigger_actor": "bazi-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:16018a0b0f874629d16718e7a4dae824ea63fdd8dcb9d59207250b1f6c4fa5fa",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "bazi_canonical_base_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "exact_reusable_base_identity_ready",
            "recovery_rule": "resume_exact_base_job_checkpoint_identity_change_creates_new_base",
            "terminal_requirement": "private_completed_checkpoint_and_output_hash",
            "order_contract": {
              "allowed_stage_ids": [
                "base_interpretation"
              ],
              "final_stage_id": "base_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "chart_material",
                  "corpus_material",
                  "frozen_bazi_subject"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:bazi_canonical_base_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "base_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "frozen_bazi_subject",
                    "chart_material",
                    "corpus_material"
                  ],
                  "output_contract_ref": "product-execution-output:base_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "chart_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "exact_completed_reusable_base_checkpoint",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "bazi_basic_chart_ready_and_exact_base_terminal",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "chart_interpretation_terminal_and_report_projection",
            "order_contract": {
              "allowed_stage_ids": [
                "chart_interpretation"
              ],
              "final_stage_id": "chart_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fork_from_exact_base",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_reusable_base_checkpoint",
                  "product_materials"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:chart_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "chart_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fork",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_reusable_base_checkpoint",
                    "product_materials"
                  ],
                  "output_contract_ref": "product-execution-output:chart_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [
          {
            "from": "bazi_canonical_base_interpretation",
            "to": "chart_interpretation",
            "type": "exact_reusable_parent"
          }
        ],
        "terminal_rule": "chart_interpretation_terminal_and_report_projection",
        "output_projection": "bazi_chart_interpretation_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "bazi_ai_full_analysis",
      "product_id": "bazi_ai_full_analysis",
      "owner_domain": "bazi",
      "trigger_actor": "bazi-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:de1af4bd88b87455b5284c7a2f42eb07ca7db1a976d8394b545ee4af86c5dc3b",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "bazi_canonical_base_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "exact_reusable_base_identity_ready",
            "recovery_rule": "resume_exact_base_job_checkpoint_identity_change_creates_new_base",
            "terminal_requirement": "private_completed_checkpoint_and_output_hash",
            "order_contract": {
              "allowed_stage_ids": [
                "base_interpretation"
              ],
              "final_stage_id": "base_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "chart_material",
                  "corpus_material",
                  "frozen_bazi_subject"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:bazi_canonical_base_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "base_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "frozen_bazi_subject",
                    "chart_material",
                    "corpus_material"
                  ],
                  "output_contract_ref": "product-execution-output:base_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "question_analysis",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "exact_completed_reusable_base_checkpoint",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "bazi_basic_chart_ready_and_exact_base_terminal",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "question_analysis_terminal_and_formal_analysis",
            "order_contract": {
              "allowed_stage_ids": [
                "question_analysis"
              ],
              "final_stage_id": "question_analysis",
              "stage_count": 1,
              "conversation_scope_policy": "fork_from_exact_base",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_reusable_base_checkpoint",
                  "product_materials"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:question_analysis",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "question_analysis",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fork",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_reusable_base_checkpoint",
                    "product_materials"
                  ],
                  "output_contract_ref": "product-execution-output:question_analysis",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [
          {
            "from": "bazi_canonical_base_interpretation",
            "to": "question_analysis",
            "type": "exact_reusable_parent"
          }
        ],
        "terminal_rule": "question_analysis_terminal_and_formal_analysis",
        "output_projection": "bazi_full_analysis"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "bazi_report_followup",
      "product_id": "bazi_report_followup",
      "owner_domain": "bazi",
      "trigger_actor": "authenticated-user-request",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:ad6e91d3cb78db8dd0f34272b965cd9674c4daa18e347283ec2cdb3b79a2c6d3",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "question_analysis",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "completed_chart_or_full_analysis_or_previous_bazi_followup",
            "accepted_parent_contract_ids": [
              "bazi_chart_interpretation",
              "bazi_ai_full_analysis",
              "bazi_report_followup"
            ],
            "join_binding": "none",
            "readiness_rule": "exact_formal_parent_terminal_and_authenticated_request",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "new_followup_terminal_without_parent_overwrite",
            "order_contract": {
              "allowed_stage_ids": [
                "question_analysis"
              ],
              "final_stage_id": "question_analysis",
              "stage_count": 1,
              "conversation_scope_policy": "exact_same_conversation",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "completed_formal_parent",
                  "followup_question"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:question_analysis",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "question_analysis",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "completed_formal_parent",
                    "followup_question"
                  ],
                  "output_contract_ref": "product-execution-output:question_analysis",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "new_followup_terminal_without_parent_overwrite",
        "output_projection": "bazi_followup_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "qimen_professional_answer",
      "product_id": "qimen_professional_answer",
      "owner_domain": "qimen",
      "trigger_actor": "qimen-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:407901644cf1c112c785e9cd30dc3cf32c876cbf615b1bd59f16b22be4cb76cc",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "analysis",
            "order_kind": "ai_production_order",
            "creation_owner": "qimen",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "qimen_basic_chart_exact_input_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "formal_report_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "analysis"
              ],
              "final_stage_id": "analysis",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_qimen_basic_chart",
                  "question_materials"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:analysis",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "analysis",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_qimen_basic_chart",
                    "question_materials"
                  ],
                  "output_contract_ref": "product-execution-output:analysis",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "formal_report_terminal",
        "output_projection": "qimen_professional_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "qimen_report_followup",
      "product_id": "qimen_report_followup",
      "owner_domain": "commercial-order-management",
      "trigger_actor": "authenticated-user-request",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:aa966538b82b7496bc582c5f47bca58cc7c47a0739cd5fb02e8b3630068057c5",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "followup",
            "order_kind": "ai_production_order",
            "creation_owner": "commercial-order-management",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "completed_professional_answer_or_previous_qimen_followup",
            "accepted_parent_contract_ids": [
              "qimen_professional_answer",
              "qimen_report_followup"
            ],
            "join_binding": "none",
            "readiness_rule": "exact_formal_parent_terminal_and_authenticated_request",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "new_followup_terminal_without_parent_overwrite",
            "order_contract": {
              "allowed_stage_ids": [
                "followup"
              ],
              "final_stage_id": "followup",
              "stage_count": 1,
              "conversation_scope_policy": "exact_same_conversation",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "completed_qimen_formal_parent",
                  "followup_question"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:followup",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "followup",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "completed_qimen_formal_parent",
                    "followup_question"
                  ],
                  "output_contract_ref": "product-execution-output:followup",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "new_followup_terminal_without_parent_overwrite",
        "output_projection": "qimen_followup_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "hehun_ai_analysis",
      "product_id": "hehun_ai_analysis",
      "owner_domain": "hehun",
      "trigger_actor": "hehun-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:2ff5a629773574ff5e911d41115fc07773d88ab8535b7ea3370af35ed9e9c5a2",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "party_a_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "hehun",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "typed_slot_a",
            "readiness_rule": "party_a_identity_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "party_a_private_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "party_a_interpretation"
              ],
              "final_stage_id": "party_a_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "party_a_chart_materials",
                  "party_a_exact_person_identity"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:party_a_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "party_a_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "party_a_exact_person_identity",
                    "party_a_chart_materials"
                  ],
                  "output_contract_ref": "product-execution-output:party_a_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "party_b_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "hehun",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "typed_slot_b",
            "readiness_rule": "party_b_identity_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "party_b_private_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "party_b_interpretation"
              ],
              "final_stage_id": "party_b_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "party_b_chart_materials",
                  "party_b_exact_person_identity"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:party_b_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "party_b_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "party_b_exact_person_identity",
                    "party_b_chart_materials"
                  ],
                  "output_contract_ref": "product-execution-output:party_b_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "final_compatibility",
            "order_kind": "ai_production_order",
            "creation_owner": "hehun",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "exactly_two_terminal_typed_parents",
            "accepted_parent_contract_ids": [],
            "join_binding": "exact_slots_a_and_b_with_person_identity",
            "readiness_rule": "both_exact_typed_parents_terminal",
            "recovery_rule": "resume_original_final_node_never_substitute_parent",
            "terminal_requirement": "final_compatibility_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "final_compatibility"
              ],
              "final_stage_id": "final_compatibility",
              "stage_count": 1,
              "conversation_scope_policy": "typed_join_fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "hehun_case_materials",
                  "typed_parent_slot_a",
                  "typed_parent_slot_b"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:final_compatibility",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "final_compatibility",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "typed_parent_slot_a",
                    "typed_parent_slot_b",
                    "hehun_case_materials"
                  ],
                  "output_contract_ref": "product-execution-output:final_compatibility",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [
          {
            "from": "party_a_interpretation",
            "to": "final_compatibility",
            "type": "typed_parent_slot_a"
          },
          {
            "from": "party_b_interpretation",
            "to": "final_compatibility",
            "type": "typed_parent_slot_b"
          }
        ],
        "terminal_rule": "only_final_compatibility_terminal_completes_product",
        "output_projection": "hehun_final_compatibility_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "hehun_report_followup",
      "product_id": "hehun_report_followup",
      "owner_domain": "hehun",
      "trigger_actor": "authenticated-user-request",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:c6e4d1a611eb6ee5f035463d522fe310e9de2ce7c4d72610c9457ec3593f19dc",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "followup",
            "order_kind": "ai_production_order",
            "creation_owner": "hehun",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "completed_final_compatibility_or_previous_hehun_followup",
            "accepted_parent_contract_ids": [
              "hehun_ai_analysis",
              "hehun_report_followup"
            ],
            "join_binding": "none",
            "readiness_rule": "exact_formal_parent_terminal_and_authenticated_request",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "new_followup_terminal_without_parent_overwrite",
            "order_contract": {
              "allowed_stage_ids": [
                "followup"
              ],
              "final_stage_id": "followup",
              "stage_count": 1,
              "conversation_scope_policy": "exact_same_conversation",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "completed_hehun_final_or_followup_parent",
                  "followup_question"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:followup",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "followup",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "completed_hehun_final_or_followup_parent",
                    "followup_question"
                  ],
                  "output_contract_ref": "product-execution-output:followup",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "new_followup_terminal_without_parent_overwrite",
        "output_projection": "hehun_followup_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "naming_bazi_analysis_and_naming",
      "product_id": "naming_bazi_analysis_and_naming",
      "owner_domain": "naming",
      "trigger_actor": "naming-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:c5ba69681db0070e20ddc4e3714c3725ea96876bdebf6b150878ded53cdb1227",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "bazi_canonical_base_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "exact_reusable_base_identity_ready",
            "recovery_rule": "resume_exact_base_job_checkpoint_identity_change_creates_new_base",
            "terminal_requirement": "private_completed_checkpoint_and_output_hash",
            "order_contract": {
              "allowed_stage_ids": [
                "base_interpretation"
              ],
              "final_stage_id": "base_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "chart_material",
                  "corpus_material",
                  "frozen_bazi_subject"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:bazi_canonical_base_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "base_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "frozen_bazi_subject",
                    "chart_material",
                    "corpus_material"
                  ],
                  "output_contract_ref": "product-execution-output:base_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "naming_analysis_and_author",
            "order_kind": "ai_production_order",
            "creation_owner": "naming",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "first_stage_exact_completed_reusable_base_checkpoint",
            "accepted_parent_contract_ids": [],
            "join_binding": "optional_typed_person_material_only",
            "readiness_rule": "bazi_basic_chart_ready_and_exact_base_terminal",
            "recovery_rule": "resume_original_stage_completed_question_analysis_not_replayed",
            "terminal_requirement": "naming_author_terminal_and_naming_report",
            "order_contract": {
              "allowed_stage_ids": [
                "question_analysis",
                "naming_author"
              ],
              "final_stage_id": "naming_author",
              "stage_count": 2,
              "conversation_scope_policy": "fork_then_exact_same_conversation",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_reusable_base_checkpoint",
                  "naming_request_materials",
                  "optional_typed_person_material_join",
                  "question_analysis_output"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:naming_analysis_and_author",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "question_analysis",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fork",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_reusable_base_checkpoint",
                    "naming_request_materials"
                  ],
                  "output_contract_ref": "product-execution-output:question_analysis",
                  "provider_evidence_required": true
                },
                {
                  "stage_id": "naming_author",
                  "ordinal": 2,
                  "depends_on_stage_ids": [
                    "question_analysis"
                  ],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": "question_analysis",
                  "generated_inputs_from_stage_ids": [
                    "question_analysis"
                  ],
                  "required_material_roles_or_input_kinds": [
                    "question_analysis_output",
                    "optional_typed_person_material_join"
                  ],
                  "output_contract_ref": "product-execution-output:naming_author",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [
          {
            "from": "bazi_canonical_base_interpretation",
            "to": "naming_analysis_and_author",
            "type": "exact_reusable_parent"
          }
        ],
        "terminal_rule": "naming_author_terminal_and_naming_report",
        "output_projection": "naming_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "naming_from_existing_bazi_report",
      "product_id": "naming_from_existing_bazi_report",
      "owner_domain": "naming",
      "trigger_actor": "naming-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:a397f755e5ffda3dc740f3f2bcb388d24d584aae968f9139de1caed17e55af7b",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "naming_author",
            "order_kind": "ai_production_order",
            "creation_owner": "naming",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "immutable_parent_report_material_not_conversation_parent",
            "accepted_parent_contract_ids": [],
            "join_binding": "optional_typed_person_material_only",
            "readiness_rule": "completed_existing_formal_report_exact",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "single_stage_naming_report_without_source_report_rewrite",
            "order_contract": {
              "allowed_stage_ids": [
                "naming_author"
              ],
              "final_stage_id": "naming_author",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "immutable_parent_report_material",
                  "optional_typed_person_material_join"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:naming_author",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "naming_author",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "immutable_parent_report_material",
                    "optional_typed_person_material_join"
                  ],
                  "output_contract_ref": "product-execution-output:naming_author",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "single_stage_naming_report_without_source_report_rewrite",
        "output_projection": "naming_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "bazi_canonical_base_interpretation",
      "action_id": "bazi_canonical_base_interpretation",
      "owner_domain": "bazi",
      "trigger_actor": "bazi-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:f40e0b51460a5f042672187ee5c102c46abc5efc7950e440449b6771f7cb69df",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "bazi_canonical_base_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "bazi",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "exact_reusable_base_identity_ready",
            "recovery_rule": "resume_exact_base_job_checkpoint_identity_change_creates_new_base",
            "terminal_requirement": "private_completed_checkpoint_and_output_hash",
            "order_contract": {
              "allowed_stage_ids": [
                "base_interpretation"
              ],
              "final_stage_id": "base_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "chart_material",
                  "corpus_material",
                  "frozen_bazi_subject"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:bazi_canonical_base_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "base_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "frozen_bazi_subject",
                    "chart_material",
                    "corpus_material"
                  ],
                  "output_contract_ref": "product-execution-output:base_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "private_noncanonical_nonbinding_checkpoint_only",
        "output_projection": "private_reusable_base_checkpoint"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "hehun_canonical_party_a_interpretation",
      "action_id": "hehun_canonical_party_a_interpretation",
      "owner_domain": "hehun",
      "trigger_actor": "hehun-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:c22e42b4f0dcbfc0bbd5a81002d934e4f8de77b898aa2f9e42d8dee6d17e0d42",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "party_a_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "hehun",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "typed_slot_a",
            "readiness_rule": "party_a_identity_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "private_nonbinding_parent_a_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "party_a_interpretation"
              ],
              "final_stage_id": "party_a_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "party_a_chart_materials",
                  "party_a_exact_person_identity"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:party_a_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "party_a_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "party_a_exact_person_identity",
                    "party_a_chart_materials"
                  ],
                  "output_contract_ref": "product-execution-output:party_a_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "private_nonbinding_parent_a_terminal",
        "output_projection": "hehun_private_parent_a"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "hehun_canonical_party_b_interpretation",
      "action_id": "hehun_canonical_party_b_interpretation",
      "owner_domain": "hehun",
      "trigger_actor": "hehun-product-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:91218de1356057f7b5685fb52aa3c0fb9cb872598e64af9a9919824aa2a88a7b",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "party_b_interpretation",
            "order_kind": "ai_production_order",
            "creation_owner": "hehun",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "typed_slot_b",
            "readiness_rule": "party_b_identity_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "private_nonbinding_parent_b_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "party_b_interpretation"
              ],
              "final_stage_id": "party_b_interpretation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "party_b_chart_materials",
                  "party_b_exact_person_identity"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:party_b_interpretation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "party_b_interpretation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "party_b_exact_person_identity",
                    "party_b_chart_materials"
                  ],
                  "output_contract_ref": "product-execution-output:party_b_interpretation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "private_nonbinding_parent_b_terminal",
        "output_projection": "hehun_private_parent_b"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "manual_accuracy_challenge",
      "action_id": "manual_accuracy_challenge",
      "owner_domain": "ai-acceptance",
      "trigger_actor": "authenticated-review-actor",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:1f23a2e9cf89c4495724dae9d26a4caaeb20c0c1fd98ea7be9a2fa2fe9d4c7c2",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "manual_accuracy_challenge",
            "order_kind": "ai_production_order",
            "creation_owner": "ai-acceptance",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "exact_completed_parent_final_stage_hash",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "authenticated_actor_and_review_case_bound",
            "recovery_rule": "idempotent_original_review_case",
            "terminal_requirement": "append_or_open_review_case_without_parent_terminal_change",
            "order_contract": {
              "allowed_stage_ids": [
                "manual_accuracy_challenge"
              ],
              "final_stage_id": "manual_accuracy_challenge",
              "stage_count": 1,
              "conversation_scope_policy": "exact_same_conversation",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_completed_parent_final_stage_hash",
                  "review_case_materials"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:manual_accuracy_challenge",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "manual_accuracy_challenge",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_completed_parent_final_stage_hash",
                    "review_case_materials"
                  ],
                  "output_contract_ref": "product-execution-output:manual_accuracy_challenge",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "challenge_terminal_only_opens_or_appends_review_case",
        "output_projection": "review_case_entry"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "payment_screenshot_observation",
      "action_id": "payment_screenshot_observation",
      "owner_domain": "commercial-payment-evidence",
      "trigger_actor": "payment-evidence-worker",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:1cdf414f029d2b8a97da845d4c2d182951a3e81dddc7447cce3daac0e9f264af",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "payment_screenshot_observation",
            "order_kind": "ai_production_order",
            "creation_owner": "commercial-payment-evidence",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "owner_bound_screenshot_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "observation_only_no_payment_or_fulfillment_verdict",
            "order_contract": {
              "allowed_stage_ids": [
                "payment_screenshot_observation"
              ],
              "final_stage_id": "payment_screenshot_observation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "owner_bound_payment_screenshot"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:payment_screenshot_observation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "payment_screenshot_observation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "owner_bound_payment_screenshot"
                  ],
                  "output_contract_ref": "product-execution-output:payment_screenshot_observation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "observation_terminal_only_deterministic_commercial_evaluator_owns_verdict",
        "output_projection": "payment_page_observation"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "public_knowledge_article_pipeline",
      "action_id": "public_knowledge_article_pipeline",
      "owner_domain": "public-knowledge-content",
      "trigger_actor": "public-knowledge-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:8b8cada7e88a98a20abee9dc5fc45a38d85295fa556e2bed7aa08730fcc1186d",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "public_knowledge_article_pipeline",
            "order_kind": "ai_production_order",
            "creation_owner": "public-knowledge-content",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "three_round_materials_frozen_before_job_create",
            "recovery_rule": "resume_original_stage_captured_text_and_image_not_replayed",
            "terminal_requirement": "article_image_generation_terminal",
            "order_contract": {
              "allowed_stage_ids": [
                "corpus_research",
                "article_synthesis",
                "article_image_generation"
              ],
              "final_stage_id": "article_image_generation",
              "stage_count": 3,
              "conversation_scope_policy": "single_job_exact_same_conversation",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "article_brief",
                  "article_synthesis_output",
                  "corpus_research_output",
                  "frozen_corpus_and_article_brief",
                  "image_brief"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:public_knowledge_article_pipeline",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "corpus_research",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "frozen_corpus_and_article_brief"
                  ],
                  "output_contract_ref": "product-execution-output:corpus_research",
                  "provider_evidence_required": true
                },
                {
                  "stage_id": "article_synthesis",
                  "ordinal": 2,
                  "depends_on_stage_ids": [
                    "corpus_research"
                  ],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": "corpus_research",
                  "generated_inputs_from_stage_ids": [
                    "corpus_research"
                  ],
                  "required_material_roles_or_input_kinds": [
                    "corpus_research_output",
                    "article_brief"
                  ],
                  "output_contract_ref": "product-execution-output:article_synthesis",
                  "provider_evidence_required": true
                },
                {
                  "stage_id": "article_image_generation",
                  "ordinal": 3,
                  "depends_on_stage_ids": [
                    "article_synthesis"
                  ],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": "article_synthesis",
                  "generated_inputs_from_stage_ids": [
                    "article_synthesis"
                  ],
                  "required_material_roles_or_input_kinds": [
                    "article_synthesis_output",
                    "image_brief"
                  ],
                  "output_contract_ref": "product-execution-output:article_image_generation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "article_image_generation_terminal",
        "output_projection": "public_knowledge_article_and_image"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "localization_report_translation",
      "action_id": "localization_report_translation",
      "owner_domain": "localization",
      "trigger_actor": "localization-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:ac6e9c7fed61dba6713ed652a87e77d14f2e209ded67800fe7a252b75b2b3018",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "report_translation",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "source_report_and_locale_contract_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "exact_translated_report_contract",
            "order_contract": {
              "allowed_stage_ids": [
                "report_translation"
              ],
              "final_stage_id": "report_translation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_source_report",
                  "locale_contract"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:report_translation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "report_translation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_source_report",
                    "locale_contract"
                  ],
                  "output_contract_ref": "product-execution-output:report_translation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "report_translation_terminal",
        "output_projection": "translated_report"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "localization_article_translation",
      "action_id": "localization_article_translation",
      "owner_domain": "localization",
      "trigger_actor": "localization-owner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:7acf2cce2d8adc3cf8b123f71a3c9ba759eec259d13697dac7652bb9a812c1f3",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "article_translation",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "source_article_and_locale_contract_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "exact_translated_article_contract",
            "order_contract": {
              "allowed_stage_ids": [
                "article_translation"
              ],
              "final_stage_id": "article_translation",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "exact_source_article",
                  "locale_contract"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:article_translation",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "article_translation",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "exact_source_article",
                    "locale_contract"
                  ],
                  "output_contract_ref": "product-execution-output:article_translation",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "article_translation_terminal",
        "output_projection": "translated_article"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "localization_static_review_candidate",
      "action_id": "localization_static_review_candidate",
      "owner_domain": "localization",
      "trigger_actor": "localization-review-runner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:1f6355cfe35976fe7b4763f4b7c83f5649347564662a41ec393f807c16385d49",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "candidate_a",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "candidate_materials_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "candidate_a_receipt",
            "order_contract": {
              "allowed_stage_ids": [
                "candidate_a"
              ],
              "final_stage_id": "candidate_a",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "locale_contract",
                  "static_candidate_materials"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:candidate_a",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "candidate_a",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "static_candidate_materials",
                    "locale_contract"
                  ],
                  "output_contract_ref": "product-execution-output:candidate_a",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "candidate_b",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "candidate_materials_ready",
            "recovery_rule": "resume_original_job_stage_and_checkpoint",
            "terminal_requirement": "candidate_b_receipt",
            "order_contract": {
              "allowed_stage_ids": [
                "candidate_b"
              ],
              "final_stage_id": "candidate_b",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "locale_contract",
                  "static_candidate_materials"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:candidate_b",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "candidate_b",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "static_candidate_materials",
                    "locale_contract"
                  ],
                  "output_contract_ref": "product-execution-output:candidate_b",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "both_candidate_receipts_required_before_selector",
        "output_projection": "localization_candidate_pair"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "localization_static_review_selector",
      "action_id": "localization_static_review_selector",
      "owner_domain": "localization",
      "trigger_actor": "localization-review-runner",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:4e2d0a1a158d419c76d60ff33737f035cb7701786646aafbaf305e229b76a88b",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "selector_first",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "none",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "both_candidate_receipts_valid",
            "recovery_rule": "resume_original_selector_first_job",
            "terminal_requirement": "selector_first_terminal_receipt",
            "order_contract": {
              "allowed_stage_ids": [
                "selector_first"
              ],
              "final_stage_id": "selector_first",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "candidate_a_receipt",
                  "candidate_b_receipt"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:selector_first",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "selector_first",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "candidate_a_receipt",
                    "candidate_b_receipt"
                  ],
                  "output_contract_ref": "product-execution-output:selector_first",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "selector_swap",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "exact_selector_first_terminal_same_conversation",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "selector_first_terminal_and_same_candidate_pair",
            "recovery_rule": "resume_original_selector_swap_job_without_replaying_selector_first",
            "terminal_requirement": "selector_swap_terminal_receipt",
            "order_contract": {
              "allowed_stage_ids": [
                "selector_swap"
              ],
              "final_stage_id": "selector_swap",
              "stage_count": 1,
              "conversation_scope_policy": "exact_same_conversation_as_selector_first",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "candidate_a_receipt",
                  "candidate_b_receipt",
                  "selector_first_output"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:selector_swap",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "selector_swap",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "continue_exact",
                  "continuation_from_stage_id": "selector_first",
                  "generated_inputs_from_stage_ids": [
                    "selector_first"
                  ],
                  "required_material_roles_or_input_kinds": [
                    "candidate_a_receipt",
                    "candidate_b_receipt",
                    "selector_first_output"
                  ],
                  "output_contract_ref": "product-execution-output:selector_swap",
                  "provider_evidence_required": true
                }
              ]
            }
          },
          {
            "node_id": "consistency",
            "order_kind": "ai_production_order",
            "creation_owner": "localization",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "selected_catalog_material_not_conversation_parent",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "selector_first_and_swap_agree_selected_catalog_ready",
            "recovery_rule": "resume_original_consistency_job",
            "terminal_requirement": "consistency_terminal_receipt",
            "order_contract": {
              "allowed_stage_ids": [
                "consistency"
              ],
              "final_stage_id": "consistency",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "selected_catalog",
                  "selector_receipts"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:consistency",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "consistency",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [
                    "selector_first",
                    "selector_swap"
                  ],
                  "required_material_roles_or_input_kinds": [
                    "selected_catalog",
                    "selector_receipts"
                  ],
                  "output_contract_ref": "product-execution-output:consistency",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [
          {
            "from": "selector_first",
            "to": "selector_swap",
            "type": "exact_same_conversation_parent"
          },
          {
            "from": "selector_swap",
            "to": "consistency",
            "type": "selected_catalog_readiness_dependency"
          }
        ],
        "terminal_rule": "production_approved_only_when_selectors_agree_and_consistency_passes",
        "output_projection": "localization_review_verdict"
      }
    },
    {
      "schema_version": 1,
      "contract_id": "scheduled_quality_reflection",
      "action_id": "scheduled_quality_reflection",
      "owner_domain": "ai-acceptance",
      "trigger_actor": "scheduler-due-materializer",
      "service_class": "browser_required",
      "trigger_kind": "owner_authorized",
      "product_contract_version": 1,
      "product_contract_hash": "sha256:135702c01260406fc1433a6d03d3db422b5f13b0b6022a58fb4488c085a4bfa7",
      "job_contract_version": 1,
      "required_capabilities": [
        "browser_authority",
        "provider_web"
      ],
      "product_graph": {
        "nodes": [
          {
            "node_id": "scheduled_quality_reflection",
            "order_kind": "ai_production_order",
            "creation_owner": "ai-acceptance",
            "dependency_mode": "all_declared_dependencies_ready",
            "parent_binding": "completed_user_product_final_snapshot_material",
            "accepted_parent_contract_ids": [],
            "join_binding": "none",
            "readiness_rule": "owner_scoped_due_schedule_ready",
            "recovery_rule": "idempotent_due_materialization_without_product_law_prompt_or_online_answer_mutation",
            "terminal_requirement": "advisory_finding_pending_triage_only",
            "order_contract": {
              "allowed_stage_ids": [
                "scheduled_quality_reflection"
              ],
              "final_stage_id": "scheduled_quality_reflection",
              "stage_count": 1,
              "conversation_scope_policy": "fresh",
              "provider_profile_binding": {
                "mode": "required_exact_generated_binding",
                "source": "provider-skill"
              },
              "input_contract": {
                "identity": "immutable_material_and_business_identity",
                "required_roles": [
                  "completed_user_product_final_snapshot"
                ]
              },
              "output_contract": {
                "identity": "product-execution-output:scheduled_quality_reflection",
                "provider_evidence_required": true
              },
              "stages": [
                {
                  "stage_id": "scheduled_quality_reflection",
                  "ordinal": 1,
                  "depends_on_stage_ids": [],
                  "conversation_mode": "fresh",
                  "continuation_from_stage_id": null,
                  "generated_inputs_from_stage_ids": [],
                  "required_material_roles_or_input_kinds": [
                    "completed_user_product_final_snapshot"
                  ],
                  "output_contract_ref": "product-execution-output:scheduled_quality_reflection",
                  "provider_evidence_required": true
                }
              ]
            }
          }
        ],
        "edges": [],
        "terminal_rule": "advisory_finding_pending_triage_only",
        "output_projection": "quality_reflection_finding"
      }
    }
  ],
  "bundle_hash": "sha256:7b08547a1d432ecd34832f5743bcfd50651983ab8f4aa3d99822e4dc79982c36"
} as const;
const productExecutionContracts = productExecutionBundle.contracts;

export type V6Sha256 = `sha256:${string}`;
export type ClaimOutcomeV6 =
  | "LEASE_GRANTED"
  | "NO_ELIGIBLE_JOB"
  | "CAPACITY_ZERO"
  | "CLAIM_BLOCKED"
  | "DRAINING";

export type DeviceEnrollmentV6 = Readonly<{
  schema_version: "xuanxue-ai-device-enrollment.v6";
  request_id: string;
  environment_id: string;
  enrollment_token: string;
  control_manifest_hash: V6Sha256;
}>;

export type WorkerSessionOpenV6 = Readonly<{
  schema_version: "xuanxue-ai-worker-session-open.v6";
  request_id: string;
  environment_id: string;
  origin: string;
  device_id: string;
  device_epoch: number;
  worker_instance_id: string;
  agent_build_hash: V6Sha256;
  control_manifest_hash: V6Sha256;
}>;

export type WorkerSessionCredentialV6 = Readonly<{
  schema_version: "xuanxue-ai-worker-session-credential.v6";
  worker_session_id: string;
  worker_session_epoch: number;
  token: string;
  token_generation: number;
  issued_at: string;
  expires_at: string;
  previous_generation_valid_until: string | null;
}>;

export type WorkerRuntimeAttestationV6 = Readonly<{
  schema_version: "xuanxue-ai-worker-runtime-attestation.v6";
  request_id: string;
  attestation_seq: number;
  worker_session_id: string;
  worker_session_epoch: number;
  control_manifest_hash: V6Sha256;
  product_bundle_hash: V6Sha256;
  business_capacity_total: 10;
  business_in_flight: number;
  browser_action_capacity_total: 1;
  browser_action_in_flight: 0 | 1;
  browser_authority_state: "present" | "absent";
  browser_target_state: "claimed" | "absent";
  browser_lane_state: "idle" | "busy" | "blocked";
  drain_state: "open" | "draining";
  ledger_reconciled: boolean;
}>;

export type RuntimeAttestationReceiptV6 = Readonly<{
  schema_version: "xuanxue-ai-runtime-attestation-receipt.v6";
  receipt_id: string;
  receipt_hash: V6Sha256;
  worker_session_id: string;
  worker_session_epoch: number;
  attestation_seq: number;
  payload_hash: V6Sha256;
  server_signature: V6Sha256;
  issued_at: string;
  expires_at: string;
  claim_eligible: boolean;
  reason_codes: readonly string[];
}>;

export type ClaimRequestV6 = Readonly<{
  schema_version: "xuanxue-ai-claim-request.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  requested_limit: number;
  runtime_attestation_receipt_hash: V6Sha256;
}>;

export type ExecutionFenceV6 = Readonly<{
  schema_version: "xuanxue-ai-execution-fence.v6";
  environment_id: string;
  device_id: string;
  device_epoch: number;
  worker_session_id: string;
  worker_session_epoch: number;
  job_id: string;
  attempt_id: string;
  lease_version: number;
  lease_token_hash: V6Sha256;
  control_contract_manifest_hash: V6Sha256;
  fence_hash: V6Sha256;
}>;

export type LeaseTimingV6 = Readonly<{
  schema_version: "xuanxue-ai-lease-timing.v6";
  server_now: string;
  accept_by: string;
  lease_expires_at: string;
  renew_after_ms: 20_000;
  safety_margin_ms: 10_000;
}>;

export type CloudExecutionGrantV6 = Readonly<{
  schema_version: "xuanxue-ai-cloud-execution-grant.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  claim_batch_id: string;
  job_id: string;
  source_task_id: string;
  request_hash: V6Sha256;
  job_contract_version: string;
  product_contract_hash: V6Sha256;
  required_capabilities: readonly string[];
  attempt_id: string;
  device_id: string;
  device_epoch: number;
  worker_session_id: string;
  worker_session_epoch: number;
  lease_token: string;
  lease_version: number;
  server_now: string;
  accept_by: string;
  lease_expires_at: string;
  renew_after_ms: 20_000;
  control_contract_manifest_hash: V6Sha256;
  execution_fence: ExecutionFenceV6;
}>;

export type ClaimBatchReceiptV6 = Readonly<{
  schema_version: "xuanxue-ai-claim-batch-receipt.v6";
  claim_batch_id: string;
  request_id: string;
  request_payload_hash: V6Sha256;
  outcome: ClaimOutcomeV6;
  jobs: readonly unknown[];
  server_now: string;
  next_claim_after_ms: number;
  queue_epoch: number;
  reason_codes: readonly string[];
}>;

export type ClaimResponseV6 = ClaimBatchReceiptV6;

export type LeaseReleaseV6 = Readonly<{
  schema_version: "xuanxue-ai-lease-release.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  payload_hash: V6Sha256;
  reason_code:
    | "CAPABILITY_CHANGED_BEFORE_ACCEPT"
    | "DEADLINE_BUDGET_EXHAUSTED"
    | "LOCAL_CAPACITY_CHANGED";
}>;

export type LeaseRenewV6 = Readonly<{
  schema_version: "xuanxue-ai-lease-renew.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  checkpoint_hash: V6Sha256 | null;
}>;

export type CheckpointV6 = Readonly<{
  schema_version: "xuanxue-ai-checkpoint.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  local_order_id: string | null;
  status: "inputs_downloading" | "factory_running" | "recovery_pending";
  checkpoint_seq: number;
  checkpoint_kind: string;
  payload_hash: V6Sha256;
  object_receipts: readonly V6Sha256[];
}>;

export type ControlIntentV6 = Readonly<{
  schema_version: "xuanxue-ai-control-intent.v6";
  job_id: string;
  control_epoch: number;
  intent: "none" | "pause_requested" | "cancel_requested" | "handover_requested";
  reason_code: string | null;
}>;

export type TerminalCasV6 = Readonly<{
  schema_version: "xuanxue-ai-terminal-cas.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  terminal_status: "completed" | "failed" | "review_required" | "cancelled";
  payload_hash: V6Sha256;
  result_object_receipts: readonly V6Sha256[];
}>;

export type HandoverV6 = Readonly<{
  schema_version: "xuanxue-ai-handover.v6";
  job_id: string;
  predecessor_fence_hash: V6Sha256;
  successor_device_id: string;
  successor_worker_session_id: string;
  control_epoch: number;
}>;

export type MaterialReceiptV6 = Readonly<{
  schema_version: "xuanxue-ai-material-receipt.v6";
  object_ref: string;
  sha256: V6Sha256;
  byte_length: number;
  media_type: string;
  lease_scope_hash: V6Sha256;
}>;

export type ErrorEnvelopeV6 = Readonly<{
  schema_version: "xuanxue-ai-error-envelope.v6";
  code: string;
  owner: "website" | "agent" | "browser";
  retryable: boolean;
  request_id: string | null;
  details: Readonly<Record<string, string | number | boolean | null>>;
}>;

export const xuanxueAiProductionV6ContractManifest = Object.freeze({
  schema_version: "xuanxue-ai-production-contract-manifest.v6",
  protocol_version: "xuanxue-ai-production-v6",
  max_business_in_flight: 10,
  max_browser_in_flight: 1,
  session_credential_ttl_seconds: 180,
  session_credential_overlap_seconds: 60,
  runtime_attestation_ttl_seconds: 45,
  agent_build_binding_scope: "worker_session",
  product_capability_identity: "product_bundle_hash",
  lease_seconds: 90,
  accept_seconds: 30,
  renew_after_ms: 20_000,
  required_structures: [
    "DeviceEnrollmentV6", "WorkerSessionOpenV6", "WorkerSessionCredentialV6",
    "WorkerRuntimeAttestationV6", "RuntimeAttestationReceiptV6", "ClaimRequestV6",
    "ClaimResponseV6", "ClaimBatchReceiptV6", "CloudExecutionGrantV6", "ExecutionFenceV6",
    "LeaseTimingV6", "LeaseReleaseV6", "LeaseRenewV6", "CheckpointV6", "ControlIntentV6",
    "TerminalCasV6", "HandoverV6", "MaterialReceiptV6", "ErrorEnvelopeV6",
  ],
  claim_outcomes: [
    "LEASE_GRANTED", "NO_ELIGIBLE_JOB", "CAPACITY_ZERO", "CLAIM_BLOCKED", "DRAINING",
  ],
  control_plane_status_fields: [
    "website_core_state", "website_domain_workers_state", "ai_control_plane_state",
    "agent_link_state", "agent_contract_state", "worker_session_state",
    "browser_authority_state", "browser_target_state", "browser_lane_state",
    "claim_admission_state", "e2e_proof_state",
  ],
});

export const XUANXUE_AI_PRODUCTION_V6_MANIFEST_HASH = hashCanonicalJson(
  xuanxueAiProductionV6ContractManifest,
);

const HASH = /^sha256:[a-f0-9]{64}$/u;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isIso = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));
const exact = (value: Record<string, unknown>, keys: readonly string[], code: string): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(code);
  }
};

export function assertDeviceEnrollmentV6(value: unknown): asserts value is DeviceEnrollmentV6 {
  if (!isRecord(value)) throw new Error("AI_V6_DEVICE_ENROLLMENT_INVALID");
  exact(value, ["schema_version", "request_id", "environment_id", "enrollment_token", "control_manifest_hash"], "AI_V6_DEVICE_ENROLLMENT_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-device-enrollment.v6"
    || typeof value.request_id !== "string" || !value.request_id
    || !["production", "isolated-test"].includes(value.environment_id as string)
    || typeof value.enrollment_token !== "string" || value.enrollment_token.length < 16
    || typeof value.control_manifest_hash !== "string" || !HASH.test(value.control_manifest_hash)) {
    throw new Error("AI_V6_DEVICE_ENROLLMENT_INVALID");
  }
}

export function assertWorkerSessionOpenV6(value: unknown): asserts value is WorkerSessionOpenV6 {
  if (!isRecord(value)) throw new Error("AI_V6_SESSION_OPEN_INVALID");
  exact(value, ["schema_version", "request_id", "environment_id", "origin", "device_id", "device_epoch", "worker_instance_id", "agent_build_hash", "control_manifest_hash"], "AI_V6_SESSION_OPEN_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-worker-session-open.v6"
    || ![value.request_id, value.environment_id, value.origin, value.device_id, value.worker_instance_id].every((item) => typeof item === "string" && item.length > 0)
    || !Number.isInteger(value.device_epoch) || (value.device_epoch as number) < 1
    || typeof value.agent_build_hash !== "string" || !HASH.test(value.agent_build_hash)
    || typeof value.control_manifest_hash !== "string" || !HASH.test(value.control_manifest_hash)) {
    throw new Error("AI_V6_SESSION_OPEN_INVALID");
  }
}

export function assertWorkerSessionCredentialV6(value: unknown): asserts value is WorkerSessionCredentialV6 {
  if (!isRecord(value)) throw new Error("AI_SESSION_TOKEN_STALE");
  exact(value, ["schema_version", "worker_session_id", "worker_session_epoch", "token", "token_generation", "issued_at", "expires_at", "previous_generation_valid_until"], "AI_V6_SESSION_CREDENTIAL_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-worker-session-credential.v6"
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || typeof value.token !== "string" || !/^aisc_v6_[A-Za-z0-9_-]{32,}$/u.test(value.token)
    || !Number.isInteger(value.token_generation) || (value.token_generation as number) < 1
    || !isIso(value.issued_at) || !isIso(value.expires_at)
    || (value.previous_generation_valid_until !== null && !isIso(value.previous_generation_valid_until))
    || Date.parse(value.issued_at as string) >= Date.parse(value.expires_at as string)
    || Date.parse(value.expires_at as string) - Date.parse(value.issued_at as string) > 180_000) {
    throw new Error("AI_SESSION_TOKEN_STALE");
  }
}

export function assertRuntimeAttestationReceiptV6(value: unknown): asserts value is RuntimeAttestationReceiptV6 {
  if (!isRecord(value)) throw new Error("AI_RUNTIME_ATTESTATION_STALE");
  exact(value, ["schema_version", "receipt_id", "receipt_hash", "worker_session_id", "worker_session_epoch", "attestation_seq", "payload_hash", "server_signature", "issued_at", "expires_at", "claim_eligible", "reason_codes"], "AI_V6_ATTESTATION_RECEIPT_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-runtime-attestation-receipt.v6"
    || typeof value.receipt_id !== "string" || !value.receipt_id
    || typeof value.receipt_hash !== "string" || !HASH.test(value.receipt_hash)
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.attestation_seq) || (value.attestation_seq as number) < 1
    || typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || typeof value.server_signature !== "string" || !HASH.test(value.server_signature)
    || !isIso(value.issued_at) || !isIso(value.expires_at)
    || Date.parse(value.issued_at as string) >= Date.parse(value.expires_at as string)
    || Date.parse(value.expires_at as string) - Date.parse(value.issued_at as string) > 45_000
    || typeof value.claim_eligible !== "boolean"
    || !Array.isArray(value.reason_codes)
    || !value.reason_codes.every((item) => typeof item === "string")) {
    throw new Error("AI_RUNTIME_ATTESTATION_STALE");
  }
}

export function assertClaimRequestV6(value: unknown): asserts value is ClaimRequestV6 {
  if (!isRecord(value)) throw new Error("AI_V6_CLAIM_REQUEST_INVALID");
  exact(value, ["schema_version", "control_protocol_version", "request_id", "worker_session_id", "worker_session_epoch", "requested_limit", "runtime_attestation_receipt_hash"], "AI_V6_CLAIM_REQUEST_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-claim-request.v6"
    || value.control_protocol_version !== "xuanxue-ai-production-v6"
    || typeof value.request_id !== "string" || !value.request_id
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.requested_limit) || (value.requested_limit as number) < 1 || (value.requested_limit as number) > 10
    || typeof value.runtime_attestation_receipt_hash !== "string" || !HASH.test(value.runtime_attestation_receipt_hash)) {
    throw new Error("AI_V6_CLAIM_REQUEST_INVALID");
  }
}

export function assertWorkerRuntimeAttestationV6(
  value: unknown,
): asserts value is WorkerRuntimeAttestationV6 {
  if (!isRecord(value)) throw new Error("AI_V6_RUNTIME_ATTESTATION_INVALID");
  exact(value, ["schema_version", "request_id", "attestation_seq", "worker_session_id", "worker_session_epoch", "control_manifest_hash", "product_bundle_hash", "business_capacity_total", "business_in_flight", "browser_action_capacity_total", "browser_action_in_flight", "browser_authority_state", "browser_target_state", "browser_lane_state", "drain_state", "ledger_reconciled"], "AI_V6_RUNTIME_ATTESTATION_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-worker-runtime-attestation.v6"
    || typeof value.request_id !== "string" || !value.request_id
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.attestation_seq) || (value.attestation_seq as number) < 1
    || typeof value.control_manifest_hash !== "string" || !HASH.test(value.control_manifest_hash)
    || typeof value.product_bundle_hash !== "string" || !HASH.test(value.product_bundle_hash)
    || value.business_capacity_total !== 10
    || !Number.isInteger(value.business_in_flight) || (value.business_in_flight as number) < 0 || (value.business_in_flight as number) > 10
    || value.browser_action_capacity_total !== 1
    || ![0, 1].includes(value.browser_action_in_flight as number)
    || !["present", "absent"].includes(value.browser_authority_state as string)
    || !["claimed", "absent"].includes(value.browser_target_state as string)
    || !["idle", "busy", "blocked"].includes(value.browser_lane_state as string)
    || !["open", "draining"].includes(value.drain_state as string)
    || typeof value.ledger_reconciled !== "boolean") {
    throw new Error("AI_V6_RUNTIME_ATTESTATION_INVALID");
  }
  if (value.product_bundle_hash !== productExecutionBundle.bundle_hash) {
    throw new Error("AI_V6_PRODUCT_CONTRACT_DENOMINATOR_MISMATCH");
  }
}

export function assertCloudExecutionGrantV6(value: unknown): asserts value is CloudExecutionGrantV6 {
  if (!isRecord(value)) throw new Error("AI_V6_GRANT_INVALID");
  exact(value, ["schema_version", "control_protocol_version", "claim_batch_id", "job_id", "source_task_id", "request_hash", "job_contract_version", "product_contract_hash", "required_capabilities", "attempt_id", "device_id", "device_epoch", "worker_session_id", "worker_session_epoch", "lease_token", "lease_version", "server_now", "accept_by", "lease_expires_at", "renew_after_ms", "control_contract_manifest_hash", "execution_fence"], "AI_V6_GRANT_UNKNOWN_FIELD");
  if (!isRecord(value.execution_fence)) throw new Error("AI_V6_GRANT_INVALID");
  const fence = value.execution_fence;
  exact(fence, ["schema_version", "environment_id", "device_id", "device_epoch", "worker_session_id", "worker_session_epoch", "job_id", "attempt_id", "lease_version", "lease_token_hash", "control_contract_manifest_hash", "fence_hash"], "AI_V6_FENCE_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-cloud-execution-grant.v6"
    || value.control_protocol_version !== "xuanxue-ai-production-v6"
    || ![value.claim_batch_id, value.job_id, value.source_task_id, value.job_contract_version, value.attempt_id, value.device_id, value.worker_session_id, value.lease_token].every((item) => typeof item === "string" && item.length > 0)
    || typeof value.request_hash !== "string" || !HASH.test(value.request_hash)
    || typeof value.product_contract_hash !== "string" || !HASH.test(value.product_contract_hash)
    || !Array.isArray(value.required_capabilities)
    || !Number.isInteger(value.device_epoch) || (value.device_epoch as number) < 1
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.lease_version) || (value.lease_version as number) < 1
    || fence.schema_version !== "xuanxue-ai-execution-fence.v6"
    || fence.job_id !== value.job_id || fence.attempt_id !== value.attempt_id || fence.lease_version !== value.lease_version
    || fence.device_id !== value.device_id || fence.device_epoch !== value.device_epoch
    || fence.worker_session_id !== value.worker_session_id || fence.worker_session_epoch !== value.worker_session_epoch
    || typeof fence.lease_token_hash !== "string" || !HASH.test(fence.lease_token_hash)
    || fence.control_contract_manifest_hash !== value.control_contract_manifest_hash
    || typeof fence.fence_hash !== "string" || !HASH.test(fence.fence_hash)
    || typeof value.control_contract_manifest_hash !== "string" || !HASH.test(value.control_contract_manifest_hash)
    || !isIso(value.server_now) || !isIso(value.accept_by) || !isIso(value.lease_expires_at)
    || value.renew_after_ms !== 20_000
    || Date.parse(value.server_now) >= Date.parse(value.accept_by)
    || Date.parse(value.accept_by) >= Date.parse(value.lease_expires_at)) {
    throw new Error("AI_V6_GRANT_INVALID");
  }
  const productContract = productExecutionContracts.find(
    (contract) => contract.product_contract_hash === value.product_contract_hash,
  );
  if (!productContract
    || JSON.stringify(value.required_capabilities) !== JSON.stringify(productContract.required_capabilities)) {
    throw new Error("AI_V6_GRANT_PRODUCT_CONTRACT_MISMATCH");
  }
}

export function assertClaimBatchReceiptV6(value: unknown): asserts value is ClaimBatchReceiptV6 {
  if (!isRecord(value)) throw new Error("AI_CLAIM_IDEMPOTENCY_CONFLICT");
  exact(value, ["schema_version", "claim_batch_id", "request_id", "request_payload_hash", "outcome", "jobs", "server_now", "next_claim_after_ms", "queue_epoch", "reason_codes"], "AI_V6_CLAIM_RECEIPT_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-claim-batch-receipt.v6"
    || typeof value.claim_batch_id !== "string" || !value.claim_batch_id
    || typeof value.request_id !== "string" || !value.request_id
    || typeof value.request_payload_hash !== "string" || !HASH.test(value.request_payload_hash)
    || !xuanxueAiProductionV6ContractManifest.claim_outcomes.includes(value.outcome as ClaimOutcomeV6)
    || !Array.isArray(value.jobs)
    || !isIso(value.server_now)
    || !Number.isInteger(value.next_claim_after_ms) || (value.next_claim_after_ms as number) < 1_000 || (value.next_claim_after_ms as number) > 30_000
    || !Number.isInteger(value.queue_epoch) || (value.queue_epoch as number) < 0
    || !Array.isArray(value.reason_codes) || !value.reason_codes.every((item) => typeof item === "string")
    || ((value.outcome === "LEASE_GRANTED") !== (value.jobs.length > 0))) {
    throw new Error("AI_CLAIM_IDEMPOTENCY_CONFLICT");
  }
  for (const job of value.jobs) assertCloudExecutionGrantV6(job);
}

export function assertHandoverV6(value: unknown): asserts value is HandoverV6 {
  if (!isRecord(value)) throw new Error("AI_HANDOVER_FENCE_STALE");
  exact(value, ["schema_version", "job_id", "predecessor_fence_hash", "successor_device_id", "successor_worker_session_id", "control_epoch"], "AI_V6_HANDOVER_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-handover.v6"
    || typeof value.job_id !== "string" || !value.job_id
    || typeof value.predecessor_fence_hash !== "string" || !HASH.test(value.predecessor_fence_hash)
    || typeof value.successor_device_id !== "string" || !value.successor_device_id
    || typeof value.successor_worker_session_id !== "string" || !value.successor_worker_session_id
    || !Number.isInteger(value.control_epoch) || (value.control_epoch as number) < 1) {
    throw new Error("AI_HANDOVER_FENCE_STALE");
  }
}

export function assertXuanxueAiProductionV6Manifest(value: unknown): asserts value is typeof xuanxueAiProductionV6ContractManifest {
  if (!isRecord(value)) throw new Error("CONTRACT_CONTROL_MANIFEST_MISMATCH");
  exact(value, Object.keys(xuanxueAiProductionV6ContractManifest), "AI_V6_MANIFEST_UNKNOWN_FIELD");
  if (hashCanonicalJson(value) !== XUANXUE_AI_PRODUCTION_V6_MANIFEST_HASH) {
    throw new Error("CONTRACT_CONTROL_MANIFEST_MISMATCH");
  }
}

const assertJobFenceRequest = (
  value: Record<string, unknown>,
  schema: string,
  keys: readonly string[],
  code: string,
): void => {
  exact(value, keys, `${code}_UNKNOWN_FIELD`);
  if (value.schema_version !== schema
    || value.control_protocol_version !== "xuanxue-ai-production-v6"
    || typeof value.request_id !== "string" || !value.request_id
    || value.idempotency_key !== value.request_id
    || typeof value.job_id !== "string" || !value.job_id
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || typeof value.attempt_id !== "string" || !value.attempt_id
    || !Number.isInteger(value.lease_version) || (value.lease_version as number) < 1
    || typeof value.fence_hash !== "string" || !HASH.test(value.fence_hash)) {
    throw new Error(code);
  }
};

export function assertLeaseReleaseV6(value: unknown): asserts value is LeaseReleaseV6 {
  if (!isRecord(value)) throw new Error("AI_V6_LEASE_RELEASE_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-lease-release.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","payload_hash","reason_code"], "AI_V6_LEASE_RELEASE_INVALID");
  if (typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || !["CAPABILITY_CHANGED_BEFORE_ACCEPT", "DEADLINE_BUDGET_EXHAUSTED", "LOCAL_CAPACITY_CHANGED"].includes(value.reason_code as string)) {
    throw new Error("AI_V6_LEASE_RELEASE_INVALID");
  }
}

export function assertLeaseRenewV6(value: unknown): asserts value is LeaseRenewV6 {
  if (!isRecord(value)) throw new Error("AI_V6_LEASE_RENEW_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-lease-renew.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","checkpoint_hash"], "AI_V6_LEASE_RENEW_INVALID");
  if (value.checkpoint_hash !== null
    && (typeof value.checkpoint_hash !== "string" || !HASH.test(value.checkpoint_hash))) {
    throw new Error("AI_V6_LEASE_RENEW_INVALID");
  }
}

export function assertCheckpointV6(value: unknown): asserts value is CheckpointV6 {
  if (!isRecord(value)) throw new Error("AI_V6_CHECKPOINT_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-checkpoint.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","local_order_id","status","checkpoint_seq","checkpoint_kind","payload_hash","object_receipts"], "AI_V6_CHECKPOINT_INVALID");
  if (!Number.isInteger(value.checkpoint_seq) || (value.checkpoint_seq as number) < 1
    || typeof value.checkpoint_kind !== "string" || !value.checkpoint_kind
    || (value.local_order_id !== null && (typeof value.local_order_id !== "string" || !value.local_order_id))
    || !["inputs_downloading","factory_running","recovery_pending"].includes(value.status as string)
    || typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || !Array.isArray(value.object_receipts)
    || !value.object_receipts.every((item) => typeof item === "string" && HASH.test(item))) {
    throw new Error("AI_V6_CHECKPOINT_INVALID");
  }
}

export function assertTerminalCasV6(value: unknown): asserts value is TerminalCasV6 {
  if (!isRecord(value)) throw new Error("AI_V6_TERMINAL_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-terminal-cas.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","terminal_status","payload_hash","result_object_receipts"], "AI_V6_TERMINAL_INVALID");
  if (!["completed", "failed", "review_required", "cancelled"].includes(value.terminal_status as string)
    || typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || !Array.isArray(value.result_object_receipts)
    || !value.result_object_receipts.every((item) => typeof item === "string" && HASH.test(item))) {
    throw new Error("AI_V6_TERMINAL_INVALID");
  }
}

type GeneratedParser<T> = Readonly<{ parse(value: unknown): T }>;
const generatedParser = <T>(assertValue: (value: unknown) => asserts value is T): GeneratedParser<T> => ({
  parse(value: unknown): T {
    assertValue(value);
    return value;
  },
});

export const XuanxueAiProductionV6ManifestSchema = generatedParser(assertXuanxueAiProductionV6Manifest);
export const WorkerSessionCredentialV6Schema = generatedParser(assertWorkerSessionCredentialV6);
export const RuntimeAttestationReceiptV6Schema = generatedParser(assertRuntimeAttestationReceiptV6);
export const CloudExecutionGrantV6Schema = generatedParser(assertCloudExecutionGrantV6);
export const ClaimBatchReceiptV6Schema = generatedParser(assertClaimBatchReceiptV6);
export const HandoverV6Schema = generatedParser(assertHandoverV6);
