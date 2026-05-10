import type { ChildCapabilityStrengthEntry } from "./child-capability-strength-builder.js";

const SIDE_EFFECT_ABILITY_GROUPS = new Set(["open", "screenshot", "mouse-click", "text-input", "mouse-scroll", "forensics-persistence"]);

type ChildBaseEntry = Omit<ChildCapabilityStrengthEntry, "strengthLevel" | "blockingReasons">;
type BlockingReasonRule = {
  reason: string;
  matches: (entry: ChildBaseEntry) => boolean;
};

const addReason = (reasons: string[], condition: boolean, reason: string): void => {
  if (condition) {
    reasons.push(reason);
  }
};

export const hasForensicsRecordPath = (
  abilityGroupId: string,
  childCapabilityId: string,
  dispatchReferences: Map<string, Set<string>>,
): boolean => !SIDE_EFFECT_ABILITY_GROUPS.has(abilityGroupId) || dispatchReferences.has(childCapabilityId) || abilityGroupId === "forensics-persistence";

const hasIdentity = (entry: ChildBaseEntry): boolean =>
  [entry.declaredInContract, entry.declaredInSchema, entry.registered, entry.hasChildContract, entry.hasChildSchema, entry.hasChildImplementation].some(Boolean);

const lacksExecutablePath = (entry: ChildBaseEntry): boolean =>
  !entry.hasChildImplementation || !entry.hasExecute || !entry.returnsGovernedResult || entry.publicExecuteThrows;

const lacksAiReadiness = (entry: ChildBaseEntry): boolean =>
  !entry.hasMuscleMemoryAction || !entry.allowedForAiActionPlan || !entry.hasForensicsRecordPath;

const BLOCKING_REASON_RULES: BlockingReasonRule[] = [
  { reason: "CHILD_NOT_REGISTERED", matches: (entry) => !entry.registered && (entry.declaredInSchema || entry.hasChildImplementation || entry.hasMuscleMemoryAction) },
  { reason: "CHILD_NOT_IN_SCHEMA_UNION", matches: (entry) => !entry.declaredInSchema && (entry.registered || entry.hasChildImplementation || entry.hasMuscleMemoryAction) },
  { reason: "CHILD_HAS_NO_IMPLEMENTATION", matches: (entry) => !entry.hasChildImplementation && (entry.registered || entry.hasMuscleMemoryAction) },
  { reason: "CHILD_HAS_NO_EXECUTE", matches: (entry) => entry.hasChildImplementation && !entry.hasExecute },
  { reason: "CHILD_RETURNS_FAKE_SUCCESS", matches: (entry) => entry.hasExecute && !entry.returnsGovernedResult },
  { reason: "CHILD_PUBLIC_EXECUTE_THROWS", matches: (entry) => entry.publicExecuteThrows },
  { reason: "AI_ACTION_WITHOUT_CHILD_PATH", matches: (entry) => entry.allowedForAiActionPlan && (!entry.registered || !entry.hasChildImplementation || !entry.hasExecute) },
  { reason: "AI_ACTION_WITHOUT_NERVE_BUS_PATH", matches: (entry) => entry.allowedForAiActionPlan && !entry.hasNerveBusDispatchBuilder },
  { reason: "SIDE_EFFECT_ACTION_WITHOUT_FORENSICS", matches: (entry) => SIDE_EFFECT_ABILITY_GROUPS.has(entry.abilityGroupId) && !entry.hasForensicsRecordPath },
];

export const buildBlockingReasons = (entry: ChildBaseEntry): string[] => {
  const reasons = BLOCKING_REASON_RULES.reduce<string[]>((allReasons, rule) => {
    addReason(allReasons, rule.matches(entry), rule.reason);
    return allReasons;
  }, []);
  return [...new Set(reasons)].sort((left, right) => left.localeCompare(right));
};

export const resolveStrengthLevel = (entry: ChildBaseEntry): 0 | 1 | 2 | 3 | 4 => {
  if (!hasIdentity(entry)) return 0;
  if (lacksExecutablePath(entry)) return 1;
  if (!entry.hasNerveBusDispatchBuilder) return 2;
  return lacksAiReadiness(entry) ? 3 : 4;
};