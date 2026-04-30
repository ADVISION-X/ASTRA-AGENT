import { randomUUID } from "node:crypto";

import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";

export function rollbackMapPackage(input: {
  registry: MapPluginRegistry;
  mapId: string;
  rolledBackBy: string;
  reason: string;
}) {
  const registration = input.registry.active.getRegistration(input.mapId);
  if (!registration) {
    return { rolledBack: false, reason: "map_not_active" as const };
  }

  input.registry.active.deactivate(input.mapId);
  const rollbackRecord = {
    rollbackId: randomUUID(),
    activationId: registration.activationRecord.activationId,
    packageId: registration.mapPackage.manifest.packageId,
    packageVersion: registration.mapPackage.manifest.packageVersion,
    mapId: registration.mapPackage.manifest.mapId,
    rolledBackBy: input.rolledBackBy,
    rolledBackAt: new Date().toISOString(),
    reason: input.reason
  };
  input.registry.rollbacks.write(rollbackRecord);
  return { rolledBack: true, rollbackRecord };
}
