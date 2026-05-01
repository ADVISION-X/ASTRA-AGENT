import { randomUUID } from "node:crypto";

export const createForensicsEventId = (): string => `event:${randomUUID()}`;