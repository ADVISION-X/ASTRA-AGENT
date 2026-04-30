import type { MapRollbackRecord } from "../shared/map-package-proof.js";

export class MapRollbackRecordStore {
  private readonly records = new Map<string, MapRollbackRecord>();

  write(record: MapRollbackRecord): void {
    this.records.set(record.rollbackId, record);
  }

  list(): MapRollbackRecord[] {
    return [...this.records.values()];
  }
}
