const BLOCKED_CATEGORY_TO_DECISION = {
  AUTH_REQUIRED: "BLOCKED_AUTH_REQUIRED",
  EXTERNAL_PLATFORM_SECURITY: "BLOCKED_EXTERNAL_PLATFORM_SECURITY",
  ENV_MISSING: "BLOCKED_ENV_MISSING",
  LAW_CONFLICT: "BLOCKED_LAW_CONFLICT",
  BLOCKED_NO_ACTIVE_MAP: "BLOCKED_NO_ACTIVE_MAP",
  BLOCKED_NO_PROMPT_CONTRACT: "BLOCKED_NO_PROMPT_CONTRACT",
  BLOCKED_MAP_NOT_ACTIVATED: "BLOCKED_MAP_NOT_ACTIVATED",
  BLOCKED_MAP_AUTHORING_NOT_IMPLEMENTED: "BLOCKED_MAP_AUTHORING_NOT_IMPLEMENTED",
  BLOCKED_MAP_VALIDATION_INCOMPLETE: "BLOCKED_MAP_VALIDATION_INCOMPLETE",
  BLOCKED_COMMANDER_ENTRY_MISSING: "BLOCKED_COMMANDER_ENTRY_MISSING",
  BLOCKED_PREVIOUS_REPAIR_PACKET_MISSING: "BLOCKED_PREVIOUS_REPAIR_PACKET_MISSING",
  BLOCKED_CODEX_CLI_NOT_IMPLEMENTED: "BLOCKED_CODEX_CLI_NOT_IMPLEMENTED",
};

function isPassVerification(verificationResult) {
  if (!verificationResult) {
    return false;
  }

  return hasPassingAuditVerification(verificationResult)
    && hasNoRemainingP0(verificationResult)
    && verificationResult.ciFull === "PASS"
    && verificationResult.runtimeScenario === "PASS"
    && verificationResult.lawEnforcementPassed === true;
}

function hasPassingAuditVerification(verificationResult) {
  return verificationResult.auditBuild === "PASS"
    && (verificationResult.ownerAuditRequired === false || verificationResult.ownerAudit === "PASS");
}

function hasNoRemainingP0(verificationResult) {
  return Array.isArray(verificationResult.remainingP0)
    && verificationResult.remainingP0.length === 0;
}

function resolveBlockedDecision(classification) {
  return BLOCKED_CATEGORY_TO_DECISION[classification.failureCategory] ?? null;
}

function createDecision(decision, reason) {
  return { decision, reason };
}

function resolveGitGuardDecision(input) {
  return input.gitGuard?.decision === "REJECT_REPAIR"
    ? createDecision("REJECT_REPAIR", input.gitGuard.reason ?? "Git guard rejected the repair scope.")
    : null;
}

function resolveRepeatedFailureDecision(input) {
  return (input.identicalFailureCount ?? 0) >= 3
    ? createDecision("NO_PROGRESS_AFTER_3_IDENTICAL_FAILURES", "The same failure category repeated for three iterations without progress.")
    : null;
}

function resolveBlockedClassificationDecision(input) {
  const blockedDecision = resolveBlockedDecision(input.classification);
  return blockedDecision ? createDecision(blockedDecision, input.classification.rootCause) : null;
}

function resolvePassDecision(verificationResult) {
  return isPassVerification(verificationResult)
    ? createDecision("PASS", "Scenario, CI-FULL, and owner law linkage all passed.")
    : null;
}

function hasContinueInputs(input) {
  return Boolean(input.classification?.owner)
    && Array.isArray(input.route?.allowedModify)
    && input.route.allowedModify.length > 0
    && Boolean(input.repairPacket);
}

function resolveContinueDecision(input) {
  if (!hasContinueInputs(input)) {
    return null;
  }

  return input.repairMode === "codex-cli"
    ? createDecision("BLOCKED_CODEX_CLI_NOT_IMPLEMENTED", "repairMode=codex-cli is not implemented.")
    : createDecision("CONTINUE", input.classification.rootCause);
}

export function decideNextAction(input) {
  return [
    resolveGitGuardDecision(input),
    resolveBlockedClassificationDecision(input),
    resolveRepeatedFailureDecision(input),
    resolvePassDecision(input.verificationResult),
    resolveContinueDecision(input),
  ].find(Boolean) ?? createDecision("REJECT_REPAIR", "No actionable owner route or repair packet is available for the current failure.");
}
