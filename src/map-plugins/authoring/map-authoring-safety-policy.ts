export const MAP_AUTHORING_SAFETY_POLICY = [
  "Do not invent unsupported ability groups or childCapabilityIds.",
  "Do not inline rawPrompt, systemPrompt, userPrompt, executablePromptLogic, handler, script, exec, or shell fields into generated packages.",
  "Every AI step must bind promptContractId, requiredInputRefs, and outputSchemaRef from the governed prompt contract catalog.",
  "AI-generated maps stay draft-only until quarantine validation succeeds and a human approval reference exists.",
  "Never request credentials, cookies, hidden tokens, or anti-abuse bypass instructions.",
] as const;