import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const parseBrowserReleaseAcceptanceArguments = (argv: readonly string[]): ReadonlyMap<string, string | true> => {
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      parsed.set(token, value);
      index += 1;
      continue;
    }
    parsed.set(token, true);
  }
  return parsed;
};

export const resolveBrowserReleaseDeliverable = (uri: string): string => {
  assert.ok(uri.startsWith("deliverable://"), `Expected Browser release deliverable URI, received ${uri}.`);
  const segments = uri.slice("deliverable://".length).split("/");
  assert.ok(
    segments.length > 0 && segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    `Unsafe Browser release deliverable URI: ${uri}`,
  );
  const root = path.resolve(process.env.GRASSEYE_DELIVERABLES_DIR?.trim() || ".grasseye-local/deliverables");
  const resolved = path.resolve(root, ...segments);
  assert.ok(resolved.startsWith(`${root}${path.sep}`), `Browser release deliverable escapes its root: ${uri}`);
  return resolved;
};

export const readBrowserReleaseDeliverableJson = <T,>(uri: string): T => {
  const inputPath = resolveBrowserReleaseDeliverable(uri);
  assert.ok(existsSync(inputPath), `Required Browser release deliverable is missing: ${uri}`);
  return JSON.parse(readFileSync(inputPath, "utf8")) as T;
};
