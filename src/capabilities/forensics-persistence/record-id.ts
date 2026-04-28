import { createId } from "../../lib/local-runtime/ids.js";
import type { ForensicsRecordType } from "./shared/record-envelope.js";

type CreateForensicsRecordIdInput = {
  recordType: ForensicsRecordType;
  existingRecordId?: string | undefined;
};

export function createForensicsRecordId(input: CreateForensicsRecordIdInput): string {
  if (input.existingRecordId && input.existingRecordId.trim().length > 0) {
    return input.existingRecordId;
  }

  return createId(input.recordType);
}