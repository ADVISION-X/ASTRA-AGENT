import { createHash } from "node:crypto";

type ActivationSnapshotRefInput = {
  activationId: string;
  packageVersion: string;
  mapVersion: string;
};

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForHash(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeForHash(entryValue)]),
    );
  }

  return value;
}

function hashStableValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeForHash(value)))
    .digest("hex");
}

export function buildActivationSnapshotRef(input: ActivationSnapshotRefInput): string {
  return `activation-snapshot:${input.activationId}:${input.packageVersion}:${input.mapVersion}`;
}

export function buildOperationalMapHash(value: unknown): string {
  return hashStableValue(value);
}

export function buildMapPackageHash(value: unknown): string {
  return hashStableValue(value);
}

export function buildActivationSnapshotHash(input: {
  activationSnapshotRef: string;
  mapPackageHash: string;
  operationalMapHash: string;
  capabilityCatalogVersion: string;
  promptCatalogVersion: string;
}): string {
  return hashStableValue(input);
}