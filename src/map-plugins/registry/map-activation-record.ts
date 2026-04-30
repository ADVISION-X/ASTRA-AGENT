import type { MapActivationRecord } from "../shared/map-package-proof.js";

export class MapActivationRecordStore {
  private readonly records = new Map<string, MapActivationRecord>();

  write(record: MapActivationRecord): void {
    this.records.set(record.activationId, record);
  }

  getByActivationId(activationId: string): MapActivationRecord | null {
    return this.records.get(activationId) ?? null;
  }

  list(): MapActivationRecord[] {
    return [...this.records.values()];
  }
}
