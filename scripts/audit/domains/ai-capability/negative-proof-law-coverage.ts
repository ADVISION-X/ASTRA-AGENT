export type MutationLawCoverage = {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
};

export const MUTATION_LAW_COVERAGE: Record<string, MutationLawCoverage> = {
  "public index helper mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-001-V1", "GRASSEYE-AI-CAPABILITY-004-V1", "GRASSEYE-AI-CAPABILITY-007-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-001-V1": "The mutation exports a private AI execution-context helper from the public AI root; this proves AI public sovereignty is blocked by the owner inspector.",
      "GRASSEYE-AI-CAPABILITY-004-V1": "The mutation breaks the static AI package public surface by leaking an internal runtime helper.",
      "GRASSEYE-AI-CAPABILITY-007-V1": "The mutation proves the AI owner inspector is the machine-blocking enforcement entry for AI public-surface drift.",
    },
  },
  "forbidden import mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-001-V1", "GRASSEYE-AI-CAPABILITY-003-V1", "GRASSEYE-AI-CAPABILITY-010-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-001-V1": "The mutation imports an action owner type into AI runtime code, proving AI ownership cannot mix with action ability groups.",
      "GRASSEYE-AI-CAPABILITY-003-V1": "The mutation attempts to give AI knowledge of action ownership, proving AI remains reasoning-only and cannot become an action executor.",
      "GRASSEYE-AI-CAPABILITY-010-V1": "The mutation proves action-authority imports are rejected before prompts or AI output can become action commands.",
    },
  },
  "paid execute mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-005-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-005-V1": "The mutation adds execute authority to a disabled paid provider child, proving paid providers fail closed by policy.",
    },
  },
  "forbidden action output mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-005B-V2", "GRASSEYE-AI-CAPABILITY-014-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-005B-V2": "The mutation disables forbidden output-key enforcement before Forensics persistence, proving AI output must be cleaned before persistence.",
      "GRASSEYE-AI-CAPABILITY-014-V1": "The mutation weakens the recursive action-output boundary, proving AI output cannot carry browser/action/forensics/command authority.",
    },
  },
  "as-any mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-006-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-006-V1": "The mutation injects an any escape into AI runtime code, proving the AI public/private boundary cannot be bypassed with type escapes.",
    },
  },
  "second prompt truth mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-008-V1", "GRASSEYE-AI-CAPABILITY-009-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-008-V1": "The mutation creates a second local prompt catalog, proving Prompt Contract Registry remains the only prompt truth.",
      "GRASSEYE-AI-CAPABILITY-009-V1": "The mutation proves prompt contract metadata cannot be duplicated outside the governed catalog.",
    },
  },
  "prompt registry throw mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-011-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-011-V1": "The mutation changes typed prompt resolution failure into a throw, proving prompt execution must route through governed typed failures.",
    },
  },
  "runtime signal mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-012-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-012-V1": "The mutation drops AbortController signal propagation to the runtime port, proving AI timeout and cancellation are machine-enforced.",
    },
  },
  "debug event wiring mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation removes emitDebugEvent from the configured runtime factory, proving AI_ERROR_DEBUG cannot silently disconnect from structured runtime logging.",
    },
  },
  "debug emitter required mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation lets ASK AI continue without a structured debug emitter, proving AI_REQUEST_DEBUG is a hard execution precondition.",
    },
  },
  "implementation status collapse mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation removes specific local runtime statuses, proving runtime failures cannot collapse into a single non-diagnostic reason.",
    },
  },
  "ai error diagnostic ref mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.",
    },
  },
  "proof chain mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-013-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-013-V1": "The mutation removes capabilityCallId from runtime proof identity, proving AI result proofs must remain complete and chain-linked.",
    },
  },
  "success raw output hash mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1", "GRASSEYE-AI-CAPABILITY-013-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation weakens raw response hash enforcement, proving ASK AI success requires rawResponseHash evidence.",
      "GRASSEYE-AI-CAPABILITY-013-V1": "The mutation proves AI runtime proof cannot be considered complete without rawOutputHash on success.",
    },
  },
  "input gate mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation bypasses the AI input schema gate in the runtime chain, proving provider/runtime channels cannot bypass AI-owned routing gates.",
    },
  },
  "ai debug trace step unsanctioned stepId mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-007A-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-007A-V1": "The mutation reverts the AI debug trace step field to use input.stepId, which is an orchestration map step ID not in the RoundLifecycleStepSchema enum, causing StructuredRuntimeEventSchema.parse to throw at runtime and silently suppressing AI_REQUEST_DEBUG from the terminal observer. The proof chain inspector must catch this regression.",
    },
  },
  "product presence prompt uncertain mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation reintroduces product_uncertain/human-review wording into the autonomous product-presence prompt, proving binary YES/NO prompt governance is machine-blocking.",
    },
  },
  "product presence schema uncertain mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation reopens product_uncertain as an output-schema value, proving product-presence runtime output stays binary for automated discovery.",
    },
  },
  "product presence low confidence review mutation": {
    coveredLawIds: ["GRASSEYE-AI-CAPABILITY-002-V1"],
    coverageReasonByLawId: {
      "GRASSEYE-AI-CAPABILITY-002-V1": "The mutation restores low-confidence human review for product-presence routing, proving automated discovery cannot be interrupted by a third AI branch.",
    },
  },
};