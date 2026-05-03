const OWNER_PATTERNS = [
  ["commander-console", /commander-console/i],
  ["orchestration", /orchestration/i],
  ["nerve-bus", /nerve-bus/i],
  ["open", /\bopen\b/i],
  ["page-state", /page-state/i],
  ["screenshot", /screenshot/i],
  ["ai", /\bai\b/i],
  ["visual-target", /visual-target/i],
  ["geometry-guard", /geometry-guard/i],
  ["mouse-click", /mouse-click/i],
  ["mouse-scroll", /mouse-scroll/i],
  ["text-input", /text-input/i],
  ["post-action-verification", /post-action-verification/i],
  ["forensics-persistence", /forensics-persistence/i],
  ["map-plugin-package", /map-plugin-package|taskTemplateId|activationSnapshotRef|selectedMapId|promptBindings/i],
  ["audit-system", /audit|law|inspector|code-purity/i],
];

const LAW_AND_AUDIT_RULES = [
  [/conflict/i, ["LAW_CONFLICT", "audit-system", "LAW_FIX"]],
  [/law|registry|matrix|enforcement/i, ["LAW_SOURCE_ERROR", "audit-system", "LAW_FIX"]],
  [/audit|inspector|negative-proof/i, ["AUDIT_ENFORCEMENT_ERROR", "audit-system", "AUDIT_FIX"]],
];

export function collectEvidenceRefs(signals = [], limit = 5) {
  return signals.slice(0, limit).map((signal) => `${signal.source}#L${signal.line}`);
}

function findOwner(logIndex, fallbackOwner = "debug-loop-controller") {
  const texts = (logIndex.ownerSignals ?? []).map((signal) => signal.text ?? "");
  for (const [ownerId, pattern] of OWNER_PATTERNS) {
    if (texts.some((text) => pattern.test(text))) {
      return ownerId;
    }
  }

  return fallbackOwner;
}

export function buildClassification(input) {
  return {
    failureCategory: input.failureCategory,
    owner: input.owner,
    severity: input.severity,
    rootCause: input.rootCause,
    firstFatal: input.firstFatal,
    evidenceRefs: input.evidenceRefs,
    allowedModify: [],
    forbiddenModify: [],
    requiredFixType: input.requiredFixType,
    secondaryFindings: input.secondaryFindings,
  };
}

function hasSignals(logIndex, bucketName) {
  return Array.isArray(logIndex?.[bucketName]) && logIndex[bucketName].length > 0;
}

function hasText(signals, pattern) {
  return signals.some((signal) => pattern.test(signal.text ?? ""));
}

function classifyLawAndAudit(logIndex) {
  const fatalContext = [logIndex.firstFatal?.text ?? "", logIndex.firstBlocking?.text ?? ""].join(" ");
  const missingAuditArtifacts = (logIndex.missingLogSources ?? []).some((sourceName) => /runner-summary|law-registry|enforcement-matrix|audit-plan/i.test(sourceName));
  const hasLawContext = /law|registry|matrix|enforcement|audit|inspector|negative-proof/i.test(fatalContext);

  if (!hasLawContext && !missingAuditArtifacts) {
    return null;
  }

  const matchedRule = LAW_AND_AUDIT_RULES.find(([pattern]) => pattern.test(fatalContext));
  return matchedRule?.[1] ?? (missingAuditArtifacts ? ["AUDIT_ENFORCEMENT_ERROR", "audit-system", "AUDIT_FIX"] : null);
}

function buildVerificationClassification(input, value) {
  return buildClassification({
    failureCategory: value.failureCategory,
    owner: value.owner,
    severity: "P0",
    rootCause: value.rootCause,
    firstFatal: input.logIndex.firstFatal?.text ?? null,
    evidenceRefs: collectEvidenceRefs(value.signals),
    requiredFixType: value.requiredFixType,
    secondaryFindings: [],
  });
}

function hasAuditVerificationFailure(verificationResult) {
  return [
    verificationResult.auditBuild === "FAIL",
    verificationResult.ownerAuditRequired === true && verificationResult.ownerAudit === "FAIL",
    verificationResult.lawEnforcementPassed === false,
    verificationResult.runnerSummaryIncludesOwner === false,
    verificationResult.warningOnlyP0 === true,
    verificationResult.detachedInspector === true,
    (verificationResult.missingMatrixLawIds?.length ?? 0) > 0,
    (verificationResult.missingAuditPlanLawIds?.length ?? 0) > 0,
    (verificationResult.missingP0P1LawCoverage?.length ?? 0) > 0,
  ].some(Boolean);
}

const VERIFICATION_FAILURE_RESOLVERS = [
  (input, verificationResult) => verificationResult.negativeProof === "FAIL" || verificationResult.emptyNegativeProof
    ? buildVerificationClassification(input, {
        failureCategory: "NEGATIVE_PROOF_ERROR",
        owner: "audit-system",
        rootCause: input.logIndex.negativeProofSignals[0]?.text ?? "Negative proof failed during verification.",
        signals: input.logIndex.negativeProofSignals,
        requiredFixType: "AUDIT_FIX",
      })
    : null,
  (input, verificationResult) => hasAuditVerificationFailure(verificationResult)
    ? buildVerificationClassification(input, {
        failureCategory: "AUDIT_ENFORCEMENT_ERROR",
        owner: "audit-system",
        rootCause: input.logIndex.firstFatal?.text ?? input.logIndex.inspectorSignals[0]?.text ?? input.logIndex.lawSignals[0]?.text ?? "Audit or law enforcement verification failed.",
        signals: [...input.logIndex.lawSignals, ...input.logIndex.inspectorSignals, ...input.logIndex.negativeProofSignals],
        requiredFixType: "AUDIT_FIX",
      })
    : null,
  (input, verificationResult) => verificationResult.ciFull === "FAIL"
    ? buildVerificationClassification(input, {
        failureCategory: "CI_ERROR",
        owner: findOwner(input.logIndex),
        rootCause: input.logIndex.firstFatal?.text ?? input.logIndex.ciSignals[0]?.text ?? "ci:full failed during verification.",
        signals: input.logIndex.ciSignals,
        requiredFixType: "RUNTIME_FIX",
      })
    : null,
  (input, verificationResult) => verificationResult.runtimeScenario === "FAIL"
    ? buildVerificationClassification(input, {
        failureCategory: "RUNTIME_ERROR",
        owner: findOwner(input.logIndex),
        rootCause: input.logIndex.firstFatal?.text ?? input.logIndex.runtimeSignals[0]?.text ?? "Runtime recheck failed during verification.",
        signals: input.logIndex.runtimeSignals,
        requiredFixType: "RUNTIME_FIX",
      })
    : null,
];

export function classifyVerificationFailure(input) {
  const verificationResult = input.verificationResult;
  if (!verificationResult || verificationResult.verdict === "PASS" || verificationResult.runtimeScenario === "BLOCKED") {
    return null;
  }

  for (const resolveClassification of VERIFICATION_FAILURE_RESOLVERS) {
    const classification = resolveClassification(input, verificationResult);
    if (classification) {
      return classification;
    }
  }

  return null;
}

function buildPriorityClassification(input, value) {
  return buildClassification({
    failureCategory: value.failureCategory,
    owner: value.owner,
    severity: value.severity ?? "P0",
    rootCause: value.rootCause,
    firstFatal: value.firstFatal ?? input.logIndex.firstFatal?.text ?? null,
    evidenceRefs: collectEvidenceRefs(value.signals ?? []),
    requiredFixType: value.requiredFixType,
    secondaryFindings: [],
  });
}

const SIGNAL_PRIORITY_RESOLVERS = [
  (input) => hasSignals(input.logIndex, "envSignals")
    ? buildPriorityClassification(input, { failureCategory: "ENV_MISSING", owner: "debug-loop-controller", rootCause: input.logIndex.envSignals[0].text, signals: input.logIndex.envSignals, requiredFixType: "ENV_FIX" })
    : null,
  (input) => {
    const firstFatalText = input.logIndex.firstFatal?.text ?? "";
    return /sharp|ERR_DLOPEN_FAILED|Could not load the "sharp" module/i.test(firstFatalText) || hasSignals(input.logIndex, "dependencySignals")
      ? buildPriorityClassification(input, {
          failureCategory: "DEPENDENCY_ERROR",
          owner: "debug-loop-controller",
          rootCause: firstFatalText || input.logIndex.dependencySignals[0].text,
          signals: input.logIndex.fatalLines.length > 0 ? input.logIndex.fatalLines : input.logIndex.dependencySignals,
          requiredFixType: "DEPENDENCY_FIX",
        })
      : null;
  },
  (input) => {
    const lawClassification = classifyLawAndAudit(input.logIndex);
    if (!lawClassification) {
      return null;
    }

    const [failureCategory, owner, requiredFixType] = lawClassification;
    return buildPriorityClassification(input, {
      failureCategory,
      owner,
      rootCause: input.logIndex.firstFatal?.text ?? input.logIndex.firstBlocking?.text ?? failureCategory,
      signals: [...input.logIndex.lawSignals, ...input.logIndex.inspectorSignals, ...input.logIndex.negativeProofSignals],
      requiredFixType,
    });
  },
  (input) => hasSignals(input.logIndex, "codePuritySignals")
    ? buildPriorityClassification(input, { failureCategory: "CODE_PURITY_ERROR", owner: "audit-system", rootCause: input.logIndex.codePuritySignals[0].text, signals: input.logIndex.codePuritySignals, requiredFixType: "AUDIT_FIX" })
    : null,
  (input) => hasSignals(input.logIndex, "promptSignals")
    ? buildPriorityClassification(input, { failureCategory: "PROMPT_CONTRACT_ERROR", owner: "ai", rootCause: input.logIndex.promptSignals[0].text, signals: input.logIndex.promptSignals, requiredFixType: "PROMPT_FIX" })
    : null,
  (input) => hasSignals(input.logIndex, "nerveBusSignals") && input.logIndex.firstFatal
    ? buildPriorityClassification(input, { failureCategory: "NERVE_BUS_ERROR", owner: "nerve-bus", rootCause: input.logIndex.firstFatal.text, firstFatal: input.logIndex.firstFatal.text, signals: input.logIndex.nerveBusSignals, requiredFixType: "RUNTIME_FIX" })
    : null,
  (input) => hasSignals(input.logIndex, "missingChainFields")
    ? buildPriorityClassification(input, { failureCategory: "PROOF_CHAIN_ERROR", owner: findOwner(input.logIndex), rootCause: input.logIndex.missingChainFields[0].text, signals: input.logIndex.missingChainFields, requiredFixType: "SCHEMA_OR_PROOF_FIX" })
    : null,
  (input) => hasSignals(input.logIndex, "forensicsSignals")
    ? buildPriorityClassification(input, { failureCategory: "FORENSICS_ERROR", owner: "forensics-persistence", rootCause: input.logIndex.forensicsSignals[0].text, signals: input.logIndex.forensicsSignals, requiredFixType: "RUNTIME_FIX" })
    : null,
  (input) => hasSignals(input.logIndex, "artifactLifecycleSignals")
    ? buildPriorityClassification(input, { failureCategory: "ARTIFACT_LIFECYCLE_ERROR", owner: findOwner(input.logIndex), rootCause: input.logIndex.artifactLifecycleSignals[0].text, signals: input.logIndex.artifactLifecycleSignals, requiredFixType: "RUNTIME_FIX" })
    : null,
  (input) => input.logIndex.firstFatal
    ? buildPriorityClassification(input, {
        failureCategory: hasSignals(input.logIndex, "ciSignals") && hasText(input.logIndex.ciSignals, /ci|typecheck|build/i) ? "CI_ERROR" : "RUNTIME_ERROR",
        owner: findOwner(input.logIndex),
        rootCause: input.logIndex.firstFatal.text,
        firstFatal: input.logIndex.firstFatal.text,
        signals: input.logIndex.fatalLines,
        requiredFixType: "RUNTIME_FIX",
      })
    : null,
  (input) => hasSignals(input.logIndex, "successSignals")
    ? buildPriorityClassification(input, { failureCategory: "PASS", owner: findOwner(input.logIndex), rootCause: "success signals detected without fatal or blocking entries", firstFatal: null, signals: input.logIndex.successSignals, requiredFixType: "NONE" })
    : null,
];

export function classifyBySignalPriority(input) {
  for (const resolveClassification of SIGNAL_PRIORITY_RESOLVERS) {
    const classification = resolveClassification(input);
    if (classification) {
      return classification;
    }
  }

  return buildPriorityClassification(input, {
    failureCategory: "UNKNOWN",
    owner: findOwner(input.logIndex),
    severity: "P1",
    rootCause: "No classifier rule matched the indexed signals.",
    firstFatal: null,
    signals: [],
    requiredFixType: "INVESTIGATE",
  });
}