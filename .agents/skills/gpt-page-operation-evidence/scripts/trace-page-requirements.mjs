import { createHash } from "node:crypto";

import { requiredPageInputRoles } from "./page-input-binding.mjs";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const sha256 = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
const exactKeys = (value, keys) => Boolean(value) && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function assertionPhase(assertions = []) {
  const phase = assertions.find((entry) => entry?.path === "stateFacts.capturePhase"
    && entry?.operator === "equals")?.value;
  if (["PRE_ACTION", "POST_ACTION", "ALREADY_SATISFIED"].includes(phase)) return phase;
  const commandKind = assertions.find((entry) => entry?.path === "related.transitionChain.typedCommand.kind"
    && entry?.operator === "equals")?.value;
  if (commandKind === "CAPTURED_BROWSER_COMMAND") return "POST_ACTION";
  if (commandKind === "ZERO_ACTION") return "ALREADY_SATISFIED";
  return "STEADY_STATE";
}

function browserObservationReached(traceEntry) {
  if ((traceEntry?.browserReceipts ?? []).length > 0) return true;
  if (/^sha256:[a-f0-9]{64}$/u.test(traceEntry?.observationRevisionHash ?? "")) return true;
  return [traceEntry?.candidateCardinality?.raw, traceEntry?.candidateCardinality?.eligible]
    .some((value) => Number.isSafeInteger(value) && value >= 0);
}

export function pageEvidenceNotApplicableForTrace(traceEntry) {
  return traceEntry?.resultStatus === "failed" && traceEntry?.mutationOutcome === "no"
    && !browserObservationReached(traceEntry);
}

export function requiredLiveStatesForTrace(requirement, traceEntry) {
  const states = requirement?.requiredLiveStates ?? [];
  const status = traceEntry?.resultStatus;
  const statusScoped = states.filter((stateId) => {
    const allowed = requirement?.traceResultStatuses?.[stateId];
    return !Array.isArray(allowed) || allowed.includes(status);
  });
  const classified = statusScoped.map((stateId) => ({
    stateId,
    phase: assertionPhase(requirement?.stateAssertions?.[stateId]),
  }));
  const outcome = traceEntry?.mutationOutcome;
  if (!["no", "dispatched", "confirmed"].includes(outcome)
    || !["success", "failed"].includes(status)) return [...statusScoped];

  if (pageEvidenceNotApplicableForTrace(traceEntry)) return [];
  if (outcome === "no") {
    const selected = classified.filter((entry) => entry.phase === "ALREADY_SATISFIED"
      || entry.phase === "STEADY_STATE").map((entry) => entry.stateId);
    return selected.length > 0 ? selected : [...statusScoped];
  }
  const selected = classified.filter((entry) => entry.phase === "PRE_ACTION"
    || entry.phase === "POST_ACTION").map((entry) => entry.stateId);
  return selected.length > 0 ? selected : classified
    .filter((entry) => entry.phase !== "ALREADY_SATISFIED").map((entry) => entry.stateId);
}

export function captureTimePageRequirementSnapshot(requirement, traceEntry, child, matrixDigest) {
  const requiredLiveStates = requiredLiveStatesForTrace(requirement, traceEntry);
  const body = stable({
    matrixDigest,
    childCandidateDigest: child.evidenceDemand.childCandidateDigest,
    requiredLiveStates,
    requiredInputRoles: requiredPageInputRoles(traceEntry.childId),
    liveStateTargets: Object.fromEntries(requiredLiveStates.map((stateId) =>
      [stateId, requirement.liveStateTargets[stateId]])),
    stateAssertions: Object.fromEntries(requiredLiveStates.map((stateId) =>
      [stateId, requirement.stateAssertions[stateId]])),
    childContract: {
      contractVersion: child.contractVersion,
      profile: child.contract.profile,
    },
  });
  return stable({ ...body, derivationDigest: sha256(JSON.stringify(body)) });
}

export function captureTimePageRequirementSnapshotValid(snapshot) {
  if (!exactKeys(snapshot, ["matrixDigest", "childCandidateDigest", "requiredLiveStates",
    "requiredInputRoles", "liveStateTargets", "stateAssertions", "childContract", "derivationDigest"])
    || !HASH.test(snapshot.matrixDigest ?? "") || !HASH.test(snapshot.childCandidateDigest ?? "")
    || !HASH.test(snapshot.derivationDigest ?? "")
    || !Array.isArray(snapshot.requiredLiveStates)
    || snapshot.requiredLiveStates.some((entry) => typeof entry !== "string" || entry.length === 0)
    || new Set(snapshot.requiredLiveStates).size !== snapshot.requiredLiveStates.length
    || !Array.isArray(snapshot.requiredInputRoles)
    || snapshot.requiredInputRoles.some((entry) => typeof entry !== "string" || entry.length === 0)
    || new Set(snapshot.requiredInputRoles).size !== snapshot.requiredInputRoles.length
    || !exactKeys(snapshot.liveStateTargets, snapshot.requiredLiveStates)
    || !exactKeys(snapshot.stateAssertions, snapshot.requiredLiveStates)
    || Object.values(snapshot.liveStateTargets).some((targets) => !Array.isArray(targets)
      || targets.length === 0 || targets.some((target) => typeof target !== "string" || target.length === 0)
      || new Set(targets).size !== targets.length)
    || Object.values(snapshot.stateAssertions).some((assertions) => !Array.isArray(assertions)
      || assertions.length === 0)
    || (!exactKeys(snapshot.childContract, ["contractVersion", "profile"])
      && !exactKeys(snapshot.childContract, ["contractVersion", "profile", "allowedDocumentTransition"]))
    || !Number.isSafeInteger(snapshot.childContract.contractVersion)
    || typeof snapshot.childContract.profile !== "string" || snapshot.childContract.profile.length === 0
    || (snapshot.childContract.allowedDocumentTransition !== undefined
      && (typeof snapshot.childContract.allowedDocumentTransition !== "string"
        || snapshot.childContract.allowedDocumentTransition.length === 0))) return false;
  const { derivationDigest: _ignored, ...body } = snapshot;
  return snapshot.derivationDigest === sha256(JSON.stringify(stable(body)));
}

function valueAtPath(root, path) {
  return path.split(".").reduce((value, part) => value === null || value === undefined
    ? undefined : value[part], root);
}

function valuePresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function stateAssertionFailures(specimen, assertions = []) {
  const failures = [];
  for (const assertion of assertions) {
    const actual = valueAtPath(specimen, assertion.path);
    if (assertion.operator === "equals" && JSON.stringify(actual) !== JSON.stringify(assertion.value)) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:equals`);
    } else if (assertion.operator === "present" && !valuePresent(actual)) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:present`);
    } else if (assertion.operator === "absent" && valuePresent(actual)) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:absent`);
    } else if (assertion.operator === "sameAs"
      && JSON.stringify(actual) !== JSON.stringify(valueAtPath(specimen, assertion.valuePath))) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:sameAs`);
    } else if (assertion.operator === "differentFrom"
      && JSON.stringify(actual) === JSON.stringify(valueAtPath(specimen, assertion.valuePath))) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:differentFrom`);
    } else if (assertion.operator === "greaterThan"
      && !(typeof actual === "number" && actual > assertion.value)) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:${assertion.path}:greaterThan`);
    } else if (!["equals", "present", "absent", "sameAs", "differentFrom", "greaterThan"]
      .includes(assertion.operator)) {
      failures.push(`STATE_ASSERTION:${specimen.stateId}:operator`);
    }
  }
  return failures;
}

export function transitionEvidenceFailures(specimen, sceneManifest = [], childContract = null) {
  const chain = specimen?.related?.transitionChain;
  if (chain?.typedCommand?.kind !== "CAPTURED_BROWSER_COMMAND") return [];
  const failures = [];
  if (specimen?.stateFacts?.capturePhase === "POST_ACTION"
    && chain?.directPostcondition?.passed !== true) {
    failures.push(`TRANSITION_POSTCONDITION:${specimen.stateId}:failed`);
  }
  const receipt = specimen?.related?.beforeAfterDiff?.transitionReceipt;
  if (childContract?.allowedDocumentTransition === "forbidden" && receipt?.preSceneId) {
    const pre = sceneManifest.find((entry) => entry?.sceneId === receipt.preSceneId);
    if (pre && pre.documentIdentityHash !== specimen.documentIdentityHash) {
      failures.push(`TRANSITION_DOCUMENT:${specimen.stateId}:forbidden-change`);
    }
  }
  return failures;
}
