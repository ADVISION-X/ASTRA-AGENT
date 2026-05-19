import type { RegisteredAtomicAbility } from "./catalog.js";

function duplicateMessage(label: string, value: string): string {
  return `Duplicate MuscleMemory ${label}: ${value}`;
}

export function mergeCapabilityCatalogEntries(
  baseEntries: RegisteredAtomicAbility[],
  extensionEntries: RegisteredAtomicAbility[],
): RegisteredAtomicAbility[] {
  const merged = [...baseEntries, ...extensionEntries];
  const actionCodes = new Set<string>();
  const childKeys = new Set<string>();

  for (const entry of merged) {
    if (actionCodes.has(entry.actionCode)) {
      throw new Error(duplicateMessage("actionCode", entry.actionCode));
    }
    actionCodes.add(entry.actionCode);

    const childKey = `${entry.abilityGroupId}:${entry.childCapabilityId}`;
    if (childKeys.has(childKey)) {
      throw new Error(duplicateMessage("ability child", childKey));
    }
    childKeys.add(childKey);
  }

  return merged;
}
