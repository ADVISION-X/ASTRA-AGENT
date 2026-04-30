import { createId } from "../../../lib/local-runtime/ids.js";

import { NerveBusPayloadDocumentSchema } from "../schema.js";
import type { NerveBusPayloadDocument, NerveBusTransportPort } from "../ports/nerve-bus-transport-port.js";

export function createInMemoryNerveBusTransportPort(): NerveBusTransportPort {
  const inputStore = new Map<string, NerveBusPayloadDocument>();
  const outputStore = new Map<string, NerveBusPayloadDocument>();

  return {
    async bindInputPayload(input) {
      const payload = NerveBusPayloadDocumentSchema.parse(input.payload);
      inputStore.set(input.inputRef, payload);
      for (const ref of input.payloadRefs) {
        inputStore.set(ref, payload);
      }
    },
    async loadInputPayload(inputRef) {
      return inputStore.get(inputRef) ?? null;
    },
    async writeOutputPayload(input) {
      const payload = NerveBusPayloadDocumentSchema.parse(input.payload);
      const outputRef = `${input.channelId}:${input.resultRef}:output`;
      const payloadRef = createId("nerve_bus_payload");
      outputStore.set(outputRef, payload);
      outputStore.set(payloadRef, payload);
      return { outputRef, payloadRefs: [payloadRef] };
    },
  };
}