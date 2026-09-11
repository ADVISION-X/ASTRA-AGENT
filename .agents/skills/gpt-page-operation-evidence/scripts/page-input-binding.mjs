import { createHash } from "node:crypto";

const HASH = /^sha256:[a-f0-9]{64}$/u;
const ROLE_KEYS = Object.freeze([
  "promptHash",
  "responseHash",
  "attachmentLabelHashes",
  "attachmentSetHash",
  "modelDisplayNameHash",
  "reasoningRequirement",
  "conversationUrlHash",
  "turnMarkerHash",
  "assistantTurnIdHash",
]);

const REQUIRED_ROLES = Object.freeze({
  verify_gpt_conversation_identity: ["promptHash", "responseHash", "conversationUrlHash", "turnMarkerHash"],
  reconcile_gpt_attachment_set: ["attachmentSetHash"],
  reconcile_gpt_draft: ["promptHash", "attachmentSetHash"],
  reconcile_gpt_turn_submission: ["promptHash"],
  checkpoint_gpt_text_response: ["responseHash", "conversationUrlHash", "turnMarkerHash", "assistantTurnIdHash"],
  checkpoint_gpt_generated_image: ["conversationUrlHash", "turnMarkerHash", "assistantTurnIdHash"],
  focus_exact_gpt_conversation: ["promptHash", "conversationUrlHash", "turnMarkerHash"],
  open_gpt_model_selector_v2: ["modelDisplayNameHash"],
  select_exact_gpt_model_v2: ["modelDisplayNameHash"],
  ensure_gpt_reasoning_requirement: ["reasoningRequirement"],
  write_exact_gpt_prompt: ["promptHash"],
  wait_for_stable_gpt_text: ["promptHash", "conversationUrlHash", "turnMarkerHash"],
  wait_for_stable_gpt_image: ["promptHash", "conversationUrlHash", "turnMarkerHash"],
  attach_approved_gpt_files_once: ["attachmentSetHash"],
  submit_exact_gpt_turn_once: ["promptHash", "attachmentSetHash"],
});

const PROMPT_EVIDENCE_POLICY = Object.freeze({
  reconcile_gpt_draft: Object.freeze({ source: "COMPOSER", states: Object.freeze([
    "exact-draft-ready", "draft-readback-stable",
  ]) }),
  write_exact_gpt_prompt: Object.freeze({ source: "COMPOSER", states: Object.freeze([
    "exact-prompt-after", "prompt-already-exact",
  ]) }),
  reconcile_gpt_turn_submission: Object.freeze({ source: "TARGET_USER_TURN", states: Object.freeze([
    "hydrated-exact-user-turn", "submitted-turn-effect-readback",
  ]) }),
  submit_exact_gpt_turn_once: Object.freeze({ source: "TARGET_USER_TURN", states: Object.freeze([
    "post-submit-user-turn", "confirmed-submit-effect-readback",
  ]) }),
});

const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

export const pageInputHash = (value) => `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
export const attachmentSetHash = (hashes) => pageInputHash(JSON.stringify(
  [...hashes].sort(),
));

const exactKeys = (value, keys) => Boolean(value) && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

const nullableHash = (value) => value === null || HASH.test(value ?? "");

export function pageInputBindingValid(binding) {
  if (!exactKeys(binding, ["schemaVersion", "source", "inputHash", "roleHashes"])
    || binding.schemaVersion !== "gpt-page-input-binding.v1"
    || !["FORENSICS_SAFE_PROJECTION", "BROWSER_MUTATION_RECEIPT_ONLY", "UNAVAILABLE"]
      .includes(binding.source)
    || !nullableHash(binding.inputHash)
    || !exactKeys(binding.roleHashes, ROLE_KEYS)) return false;
  const roles = binding.roleHashes;
  if (![roles.promptHash, roles.responseHash, roles.attachmentSetHash, roles.modelDisplayNameHash,
    roles.conversationUrlHash, roles.turnMarkerHash, roles.assistantTurnIdHash].every(nullableHash)) return false;
  if (!(roles.attachmentLabelHashes === null || (Array.isArray(roles.attachmentLabelHashes)
    && roles.attachmentLabelHashes.every((value) => HASH.test(value))
    && new Set(roles.attachmentLabelHashes).size === roles.attachmentLabelHashes.length
    && JSON.stringify(roles.attachmentLabelHashes) === JSON.stringify([...roles.attachmentLabelHashes].sort())
    && roles.attachmentSetHash === attachmentSetHash(roles.attachmentLabelHashes)))) return false;
  if (roles.attachmentLabelHashes === null && roles.attachmentSetHash !== null) return false;
  const reasoning = roles.reasoningRequirement;
  if (!(reasoning === null || (exactKeys(reasoning, ["hash", "selectionPolicy", "requestedTier"])
    && HASH.test(reasoning.hash ?? "")
    && ["exact", "exact-or-observed-maximum"].includes(reasoning.selectionPolicy)
    && ["fast", "medium", "high", "extra_high", "pro_standard"].includes(reasoning.requestedTier)
    && reasoning.hash === pageInputHash(JSON.stringify(stable({
      selectionPolicy: reasoning.selectionPolicy, requestedTier: reasoning.requestedTier,
    })))))) return false;
  if (binding.source === "FORENSICS_SAFE_PROJECTION" && !HASH.test(binding.inputHash ?? "")) return false;
  const hasRoleEvidence = ROLE_KEYS.some((key) => roles[key] !== null);
  if (binding.source === "BROWSER_MUTATION_RECEIPT_ONLY" && hasRoleEvidence) return false;
  if (binding.source === "UNAVAILABLE" && (binding.inputHash !== null || hasRoleEvidence)) return false;
  return true;
}

export const requiredPageInputRoles = (childId) => Object.freeze([...(REQUIRED_ROLES[childId] ?? [])]);

const hashes = (value) => Array.isArray(value) ? value.filter((entry) => HASH.test(entry ?? "")) : [];
const TURN_TUPLE_ROLES = Object.freeze(["promptHash", "responseHash", "turnMarkerHash", "assistantTurnIdHash"]);

const validTurnBinding = (value) => exactKeys(value,
  ["assistantTurnIdHash", "precedingPromptHash", "responseHash", "turnMarkerHashes"])
  && [value.assistantTurnIdHash, value.precedingPromptHash, value.responseHash].every(nullableHash)
  && Array.isArray(value.turnMarkerHashes) && value.turnMarkerHashes.every((entry) => HASH.test(entry ?? ""))
  && new Set(value.turnMarkerHashes).size === value.turnMarkerHashes.length
  && JSON.stringify(value.turnMarkerHashes) === JSON.stringify([...value.turnMarkerHashes].sort());

const validUserTurnBinding = (value) => exactKeys(value,
  ["promptHash", "turnMarkerHashes", "userTurnIdHash"])
  && HASH.test(value.userTurnIdHash ?? "") && HASH.test(value.promptHash ?? "")
  && Array.isArray(value.turnMarkerHashes) && value.turnMarkerHashes.every((entry) => HASH.test(entry ?? ""))
  && new Set(value.turnMarkerHashes).size === value.turnMarkerHashes.length
  && JSON.stringify(value.turnMarkerHashes) === JSON.stringify([...value.turnMarkerHashes].sort());

const turnBindingMatches = (requiredRoles, binding, facts) => {
  const tupleRoles = requiredRoles.filter((role) => TURN_TUPLE_ROLES.includes(role));
  if (tupleRoles.length < 2) return true;
  const expected = binding?.roleHashes ?? {};
  return (facts.conversationTurnBindings ?? []).some((tuple) => validTurnBinding(tuple)
    && tupleRoles.every((role) => {
      if (expected[role] === null || expected[role] === undefined) return false;
      if (role === "promptHash") return tuple.precedingPromptHash === expected.promptHash;
      if (role === "responseHash") return tuple.responseHash === expected.responseHash;
      if (role === "turnMarkerHash") return tuple.turnMarkerHashes.includes(expected.turnMarkerHash);
      return tuple.assistantTurnIdHash === expected.assistantTurnIdHash;
    }));
};

const reasoningMatches = (expected, fact) => {
  if (!expected || !fact || fact.minimum !== "0" || !["2", "4"].includes(fact.maximum)
    || !/^[0-4]$/u.test(fact.current ?? "")) return false;
  const values = Object.freeze({ fast: 0, medium: 1, high: 2, extra_high: 3, pro_standard: 4 });
  const maximum = Number(fact.maximum);
  const current = Number(fact.current);
  if (expected.selectionPolicy === "exact") {
    return values[expected.requestedTier] <= maximum && current === values[expected.requestedTier];
  }
  return expected.requestedTier === "pro_standard" && current === maximum;
};

const promptMatched = (traceEntry, expected, specimen, requiredRoles) => {
  const facts = specimen?.stateFacts ?? {};
  const policy = PROMPT_EVIDENCE_POLICY[traceEntry?.childId];
  if (policy) {
    if (!policy.states.includes(specimen?.stateId)) return false;
    if (policy.source === "COMPOSER") return facts.exactComposerHash === expected;
    const targetOwner = specimen?.core?.targets?.["user-turn"]?.ownerTurnIdHash;
    return HASH.test(targetOwner ?? "") && (facts.userTurnBindings ?? []).some((binding) =>
      validUserTurnBinding(binding) && binding.userTurnIdHash === targetOwner
      && binding.promptHash === expected);
  }
  const tupleRoles = requiredRoles.filter((role) => TURN_TUPLE_ROLES.includes(role));
  return tupleRoles.length >= 2 && hashes(facts.exactUserPromptHashes).includes(expected);
};

const roleMatched = (role, expected, traceEntry, specimen, requiredRoles) => {
  const facts = specimen?.stateFacts ?? {};
  if (role === "promptHash") {
    return promptMatched(traceEntry, expected, specimen, requiredRoles);
  }
  if (role === "responseHash") return hashes(facts.assistantSemanticTextHashes).includes(expected);
  if (role === "attachmentSetHash") {
    return Array.isArray(facts.attachmentLabelHashes)
      && attachmentSetHash(facts.attachmentLabelHashes) === expected;
  }
  if (role === "modelDisplayNameHash") return hashes(facts.visibleModelTextHashes).includes(expected);
  if (role === "reasoningRequirement") {
    return (facts.reasoningScaleFacts ?? []).some((fact) => reasoningMatches(expected, fact));
  }
  if (role === "conversationUrlHash") return facts.currentConversationUrlHash === expected;
  if (role === "turnMarkerHash") return hashes(facts.turnMarkerHashes).includes(expected);
  if (role === "assistantTurnIdHash") return hashes(facts.assistantTurnIdHashes).includes(expected);
  return false;
};

export function derivePageInputBindingProof(traceEntry, specimens, requiredRolesOverride = null) {
  const binding = traceEntry?.inputBinding;
  const requiredRoles = requiredRolesOverride === null
    ? requiredPageInputRoles(traceEntry?.childId) : Object.freeze([...requiredRolesOverride]);
  const live = Array.isArray(specimens)
    ? specimens.filter((entry) => entry?.evidenceKind === "LIVE_PAGE") : [];
  const checks = requiredRoles.map((role) => {
    const expected = binding?.roleHashes?.[role] ?? null;
    const matchedSceneIds = expected === null ? [] : live.filter((specimen) =>
      turnBindingMatches(requiredRoles, binding, specimen.stateFacts ?? {})
      && roleMatched(role, expected, traceEntry, specimen, requiredRoles)).map((specimen) => specimen.sourceSceneId);
    return stable({ role, expected, matchedSceneIds: [...new Set(matchedSceneIds)].sort(),
      status: expected !== null && matchedSceneIds.length > 0 ? "MATCHED" : "GAP" });
  });
  const inputHashBound = pageInputBindingValid(binding) && HASH.test(binding.inputHash ?? "");
  return stable({
    schemaVersion: "gpt-page-input-binding-proof.v1",
    inputHash: binding?.inputHash ?? null,
    inputHashBound,
    checks,
    complete: inputHashBound && checks.every((entry) => entry.status === "MATCHED"),
  });
}

export function pageInputBindingProofValid(proof, traceEntry, specimens, requiredRolesOverride = null) {
  return exactKeys(proof, ["schemaVersion", "inputHash", "inputHashBound", "checks", "complete"])
    && proof.schemaVersion === "gpt-page-input-binding-proof.v1"
    && JSON.stringify(proof) === JSON.stringify(derivePageInputBindingProof(
      traceEntry, specimens, requiredRolesOverride,
    ));
}
