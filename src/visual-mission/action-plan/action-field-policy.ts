import type { RegisteredAtomicAbility } from "../../muscle-memory/catalog.js";
import {
  isOwnerOnlyActionField,
  isRawExecutionActionField,
  isSystemInjectedActionField,
} from "./action-field-classifiers.js";

const EXTRA_AI_VISIBLE_FIELDS_BY_ACTION_CODE: Partial<Record<string, readonly string[]>> = {
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

export function getAiRequiredActionFields(entry: RegisteredAtomicAbility): string[] {
  return dedupeFields(entry.inputContract.requiredFields.filter((field) => !isSystemInjectedActionField(field)));
}

export function getAiOptionalActionFields(entry: RegisteredAtomicAbility): string[] {
  const requiredFields = new Set(getAiRequiredActionFields(entry));
  return dedupeFields(
    [
      ...entry.inputContract.optionalFields.filter((field) => !isSystemInjectedActionField(field)),
      ...(EXTRA_AI_VISIBLE_FIELDS_BY_ACTION_CODE[entry.actionCode] ?? []),
    ].filter((field) => !requiredFields.has(field)),
  );
}

function getSystemInjectedActionFields(entry: RegisteredAtomicAbility): string[] {
  return dedupeFields(
    [...entry.inputContract.requiredFields, ...entry.inputContract.optionalFields]
      .filter((field) => isSystemInjectedActionField(field)),
  );
}

function getAiForbiddenActionFields(entry: RegisteredAtomicAbility): string[] {
  return dedupeFields(entry.inputContract.forbiddenFields.filter((field) => !isSystemInjectedActionField(field)));
}

export function resolveAiActionInputPolicy(entry: RegisteredAtomicAbility) {
  return {
    aiRequiredInput: getAiRequiredActionFields(entry),
    aiOptionalInput: getAiOptionalActionFields(entry),
    systemInjectedInput: getSystemInjectedActionFields(entry),
    forbiddenInput: getAiForbiddenActionFields(entry),
  };
}

export function getAiVisibleActionFields(entry: RegisteredAtomicAbility): Set<string> {
  return new Set([
    ...getAiRequiredActionFields(entry),
    ...getAiOptionalActionFields(entry),
  ]);
}
