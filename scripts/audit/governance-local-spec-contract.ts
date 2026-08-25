import { cleanString, exactKeys, isStringArray, sortedUnique } from "./governance-json.js";
import { fail } from "./governance-runtime.js";

type LocalSpec = { owner: string; specKind: string; contract: unknown };
type Contract = Record<string, unknown>;

const nonEmptyStringMap = (value: unknown): boolean => Boolean(value) && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value as object).length > 0
  && Object.entries(value as Contract).every(([key, item]) => cleanString(key) && cleanString(item));

const stringArrays = (contract: Contract, keys: string[]): boolean => exactKeys(contract, keys)
  && keys.every((key) => isStringArray(contract[key]) && (contract[key] as string[]).length > 0
    && sortedUnique(contract[key] as string[]));

const typedContract = (contract: Contract): boolean => exactKeys(contract, ["fields", "typeName"])
  && cleanString(contract.typeName) && nonEmptyStringMap(contract.fields);
const apiContract = (contract: Contract): boolean => exactKeys(contract, ["method", "path", "requestType", "responseType"])
  && ["DELETE", "GET", "PATCH", "POST", "PUT"].includes(String(contract.method))
  && cleanString(contract.path) && String(contract.path).startsWith("/")
  && cleanString(contract.requestType) && cleanString(contract.responseType);
const eventContract = (contract: Contract): boolean => exactKeys(contract, ["eventName", "payloadType"])
  && cleanString(contract.eventName) && cleanString(contract.payloadType);
const storageContract = (contract: Contract): boolean => exactKeys(contract, ["fields", "recordName"])
  && cleanString(contract.recordName) && nonEmptyStringMap(contract.fields);
const configContract = (contract: Contract): boolean => exactKeys(contract, ["keys"])
  && nonEmptyStringMap(contract.keys);
const isoDate = (value: unknown): boolean => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const migrationContract = (contract: Contract): boolean => {
  if (!exactKeys(contract, [
    "compatibilityMechanisms", "currentAuthority", "maximumDurationDays", "monitoring", "removalAcceptance",
    "removalDate", "rollbackCondition", "startDate", "targetAuthority",
  ]) || !cleanString(contract.currentAuthority) || !cleanString(contract.targetAuthority)
    || !isStringArray(contract.compatibilityMechanisms) || (contract.compatibilityMechanisms as string[]).length === 0 || !sortedUnique(contract.compatibilityMechanisms as string[])
    || !isStringArray(contract.monitoring) || (contract.monitoring as string[]).length === 0 || !sortedUnique(contract.monitoring as string[])
    || !isStringArray(contract.removalAcceptance) || (contract.removalAcceptance as string[]).length === 0 || !sortedUnique(contract.removalAcceptance as string[])
    || !cleanString(contract.rollbackCondition) || !isoDate(contract.startDate) || !isoDate(contract.removalDate)
    || !Number.isInteger(contract.maximumDurationDays) || Number(contract.maximumDurationDays) < 1) return false;
  const start = Date.parse(`${String(contract.startDate)}T00:00:00Z`);
  const removal = Date.parse(`${String(contract.removalDate)}T00:00:00Z`);
  return removal >= start && removal <= start + Number(contract.maximumDurationDays) * 86_400_000;
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
