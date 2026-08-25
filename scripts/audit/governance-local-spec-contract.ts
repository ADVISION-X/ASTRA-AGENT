import { concreteString, exactKeys, isStringArray, sortedUnique } from "./governance-json.js";
import { fail } from "./governance-runtime.js";

type LocalSpec = { owner: string; specKind: string; contract: unknown };
type Contract = Record<string, unknown>;

const nonEmptyStringMap = (value: unknown): boolean => Boolean(value) && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value as object).length > 0
  && Object.entries(value as Contract).every(([key, item]) => concreteString(key) && concreteString(item));

const stringArrays = (contract: Contract, keys: string[]): boolean => exactKeys(contract, keys)
  && keys.every((key) => isStringArray(contract[key]) && (contract[key] as string[]).length > 0
    && sortedUnique(contract[key] as string[]) && (contract[key] as string[]).every(concreteString));

const typedContract = (contract: Contract): boolean => exactKeys(contract, ["fields", "typeName"])
  && concreteString(contract.typeName) && nonEmptyStringMap(contract.fields);
const apiContract = (contract: Contract): boolean => exactKeys(contract, ["method", "path", "requestType", "responseType"])
  && ["DELETE", "GET", "PATCH", "POST", "PUT"].includes(String(contract.method))
  && concreteString(contract.path) && String(contract.path).startsWith("/")
  && concreteString(contract.requestType) && concreteString(contract.responseType);
const eventContract = (contract: Contract): boolean => exactKeys(contract, ["eventName", "payloadType"])
  && concreteString(contract.eventName) && concreteString(contract.payloadType);
const storageContract = (contract: Contract): boolean => exactKeys(contract, ["fields", "recordName"])
  && concreteString(contract.recordName) && nonEmptyStringMap(contract.fields);
const configContract = (contract: Contract): boolean => exactKeys(contract, ["keys"])
  && nonEmptyStringMap(contract.keys);
const isoDate = (value: unknown): boolean => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const nonEmptySortedStringArray = (value: unknown): boolean =>
  isStringArray(value) && value.length > 0 && sortedUnique(value) && value.every(concreteString);

const migrationControlsValid = (contract: Contract): boolean =>
  nonEmptySortedStringArray(contract.compatibilityMechanisms)
  && nonEmptySortedStringArray(contract.monitoring)
  && nonEmptySortedStringArray(contract.removalAcceptance);

const migrationWindowValid = (contract: Contract): boolean => {
  if (!isoDate(contract.startDate) || !isoDate(contract.removalDate)
    || !Number.isInteger(contract.maximumDurationDays)
    || Number(contract.maximumDurationDays) < 1) return false;
  const start = Date.parse(`${String(contract.startDate)}T00:00:00Z`);
  const removal = Date.parse(`${String(contract.removalDate)}T00:00:00Z`);
  return removal >= start && removal <= start + Number(contract.maximumDurationDays) * 86_400_000;
};

const migrationContract = (contract: Contract): boolean => {
  if (!exactKeys(contract, [
    "compatibilityMechanisms", "currentAuthority", "maximumDurationDays", "monitoring", "removalAcceptance",
    "removalDate", "rollbackCondition", "startDate", "targetAuthority",
  ]) || !concreteString(contract.currentAuthority) || !concreteString(contract.targetAuthority)
    || !concreteString(contract.rollbackCondition)) return false;
  return migrationControlsValid(contract) && migrationWindowValid(contract);
};

export const validateLocalSpecContract = (raw: LocalSpec, file: string): void => {
  const contract = raw.contract as Contract;
  const validators: Record<string, () => boolean> = {
    "typed-contract": () => typedContract(contract),
    api: () => apiContract(contract),
    event: () => eventContract(contract),
    storage: () => storageContract(contract),
    "state-machine": () => stringArrays(contract, ["states", "transitions"]),
    config: () => configContract(contract),
    security: () => stringArrays(contract, ["controls"]),
    migration: () => migrationContract(contract),
  };
  if (!validators[raw.specKind]?.()) fail("SOURCE_PARSE_FAILED", `${file}:${raw.specKind}`);
};
