import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";

import { domain, pluginStatusPath } from "./inspector-constants.js";

export const findMissingRequiredFiles = (requiredFiles: readonly string[]): string[] =>
  requiredFiles.filter((file) => !existsSync(resolveFromRepo(file)));

export const countDomainPluginStatusEntries = (): number => {
  const raw = JSON.parse(readFileSync(resolveFromRepo(pluginStatusPath), "utf8")) as unknown;
  const visit = (value: unknown): number => {
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + visit(item), 0);
    if (!value || typeof value !== "object") return 0;
    const record = value as Record<string, unknown>;
    return Object.values(record).reduce<number>(
      (count, item) => count + visit(item),
      record["pluginId"] === domain ? 1 : 0,
    );
  };
  return visit(raw);
};
