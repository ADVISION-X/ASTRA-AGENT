const AI_CAPABILITY_AUDIT_CONFIG = {
  inspectorId: "ai-capability-owner",
  capabilityDomain: "ai-capability",
  inspectorEntry: "scripts/audit/domains/ai-capability/inspector.ts",
  ownedPaths: [
    "src/capabilities/ai",
    "scripts/audit/domains/ai-capability",
  ],
  allowedLawIds: [
    "GRASSEYE-AI-CAPABILITY-001-V2",
    "GRASSEYE-AI-CAPABILITY-002-V2",
    "GRASSEYE-AI-CAPABILITY-003-V2",
    "GRASSEYE-AI-CAPABILITY-004-V2",
    "GRASSEYE-AI-CAPABILITY-005-V2",
    "GRASSEYE-AI-CAPABILITY-006-V2",
  ],
  forbiddenDirectories: [
    "src/capabilities/ai/runtime-adapters",
    "src/capabilities/ai/shared",
    "src/capabilities/ai/public-contracts",
    "src/capabilities/ai/role-controls",
  ],
  forbiddenImportFragments: [
    "lib/browser",
    "capabilities/mouse-click",
    "capabilities/mouse-scroll",
    "capabilities/text-input",
    "capabilities/open",
    "capabilities/screenshot",
    "capabilities/nerve-bus",
    "capabilities/forensics-persistence",
  ],
  forbiddenCallFragments: [
    "writeAiResultRecord(",
    "dispatchAiResponse(",
    "sendCommandToAbility(",
    "writeStructuredRuntimeEvent(",
    "writeImageEvidence(",
  ],
  forbiddenOutputFragments: [
    "clientX",
    "clientY",
    "browserCommand",
    "domSelector",
    "nerveBusEnvelope",
    "forensicsPayload",
  ],
  promptRequiredFragments: [
    "User Requirement:",
    "Platform Profile:",
    "Current Visual Evidence Refs:",
    "Capability Manual:",
    "Output Schema Ref:",
  ],
  promptForbiddenFragments: [
    "provider policy",
    "fallback",
    "workflow",
    "route plan",
    "package chain",
  ],
} as const;

export { AI_CAPABILITY_AUDIT_CONFIG };