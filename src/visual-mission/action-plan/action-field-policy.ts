import type { MuscleMemoryEntry } from "../../muscle-memory/catalog/muscle-memory-catalog.schema.js";
import {
  isOwnerOnlyActionField,
  isRawExecutionActionField,
  isSystemInjectedActionField,
} from "./action-field-classifiers.js";

const EXTRA_AI_VISIBLE_FIELDS_BY_ACTION_CODE: Partial<Record<string, readonly string[]>> = {
  CLICK_CELL: ["targetName"],
};

function dedupeFields(fields: Iterable<string>): string[] {
  const orderedFields = new Set<string>();
  for (const field of fields) {
    orderedFields.add(field);
  }
  return [...orderedFields];
}

export const isAiForbiddenActionField = (field: string): boolean => (
  isOwnerOnlyActionField(field)
  || isRawExecutionActionField(field)
  || isSystemInjectedActionField(field)
);

export function getAiRequiredActionFields(entry: MuscleMemoryEntry): string[] {
  return dedupeFields(entry.inputContract.requiredFields.filter((field) => !isSystemInjectedActionField(field)));
}

export function getAiOptionalActionFields(entry: MuscleMemoryEntry): string[] {
  const requiredFields = new Set(getAiRequiredActionFields(entry));
  return dedupeFields(
    [
      ...entry.inputContract.optionalFields.filter((field) => !isSystemInjectedActionField(field)),
      ...(EXTRA_AI_VISIBLE_FIELDS_BY_ACTION_CODE[entry.actionCode] ?? []),
    ].filter((field) => !requiredFields.has(field)),
  );
}

export function getSystemInjectedActionFields(entry: MuscleMemoryEntry): string[] {
  return dedupeFields(
    [...entry.inputContract.requiredFields, ...entry.inputContract.optionalFields]
      .filter((field) => isSystemInjectedActionField(field)),
  );
}

export function getAiForbiddenActionFields(entry: MuscleMemoryEntry): string[] {
  return dedupeFields(entry.inputContract.forbiddenFields.filter((field) => !isSystemInjectedActionField(field)));
}

export function resolveAiActionInputPolicy(entry: MuscleMemoryEntry) {
  return {
    aiRequiredInput: getAiRequiredActionFields(entry),
    aiOptionalInput: getAiOptionalActionFields(entry),
    systemInjectedInput: getSystemInjectedActionFields(entry),
    forbiddenInput: getAiForbiddenActionFields(entry),
  };
}

export function getAiVisibleActionFields(entry: MuscleMemoryEntry): Set<string> {
  return new Set([
    ...getAiRequiredActionFields(entry),
    ...getAiOptionalActionFields(entry),
  ]);
}