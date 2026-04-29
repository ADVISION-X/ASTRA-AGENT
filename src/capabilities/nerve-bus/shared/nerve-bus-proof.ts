import type { z } from "zod";

import type { NerveBusTransportProofSchema } from "../schema.js";

export type NerveBusTransportProof = z.infer<typeof NerveBusTransportProofSchema>;
