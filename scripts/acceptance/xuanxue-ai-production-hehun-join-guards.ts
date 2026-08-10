import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { hash } from "./xuanxue-ai-production-fixture.js";

export const assertDuplicateHehunPartyRejected = (
  runtime: XuanxueAiProductionRuntime,
  finalOrder: XuanxueAiProductionOrder,
): void => {
  const participants = finalOrder.frozenSubject.participants.map(
    (participant, index) => index === 0
      ? participant
      : { ...participant, roleCode: "party_a" },
  );
  const duplicatePartyA: XuanxueAiProductionOrder = {
    ...finalOrder,
    orderId: "aiprod_hehun_duplicate_party_a",
    sourceTaskId: "source:aiprod_hehun_duplicate_party_a",
    requestHash: hash("aiprod_hehun_duplicate_party_a"),
    frozenSubject: {
      ...finalOrder.frozenSubject,
      participants,
      participantManifestHash: hash(JSON.stringify(participants)),
    },
    joinParents: finalOrder.joinParents.map((binding, index) => index === 0
      ? binding
      : { ...binding, participantRoleCode: "party_a" }),
  };
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, duplicatePartyA),
    /HEHUN_THREE_CONTEXTS_REQUIRED/u,
    "hehun must freeze exactly one party A and exactly one party B",
  );
};
