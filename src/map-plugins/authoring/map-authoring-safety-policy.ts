export const MAP_AUTHORING_SAFETY_POLICY = [
  "Do not invent unsupported ability groups or childCapabilityIds.",
  "Do not invent unsupported promptContractId, requiredInputRefs, outputSchemaRef, or branch fields.",
  "Do not inline rawPrompt, systemPrompt, userPrompt, executablePromptLogic, handler, script, exec, shell, import, or require fields into generated packages.",
  "Every AI step must bind promptContractId, requiredInputRefs, and outputSchemaRef from the governed prompt contract catalog.",
  "AI-generated maps stay draft-only until quarantine validation succeeds and a human approval reference exists.",
  "Never emit approvalStatus=approved, availabilityPolicy=active, validationReportRef, humanApprovalRef, activationSnapshotRef, or activation proof refs.",
  "If the request is unclear, return requiredClarifications and draftStatus=needs_clarification instead of inventing missing policy.",
  "If the governed catalogs do not support the requested flow, set needsCapabilityExpansion=true.",
  "Mutating actions such as send, publish, submit, delete, buy, or confirm must be guarded by explicit review flow.",
  "Never request credentials, cookies, hidden tokens, or anti-abuse bypass instructions.",
] as const;