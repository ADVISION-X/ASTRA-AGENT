import { NerveBusPayloadDocumentSchema } from "../schema.js";

export type NerveBusPayloadDocument = ReturnType<typeof NerveBusPayloadDocumentSchema.parse>;

export interface NerveBusTransportPort {
  bindInputPayload(input: { inputRef: string; payloadRefs: readonly string[]; payload: NerveBusPayloadDocument }): Promise<void>;
  loadInputPayload(inputRef: string): Promise<NerveBusPayloadDocument | null>;
  writeOutputPayload(input: { channelId: string; resultRef: string; payload: NerveBusPayloadDocument }): Promise<{ outputRef: string; payloadRefs: string[] }>;
}
