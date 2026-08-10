import assert from "node:assert/strict";

import {
  createXuanxueAiProductionOrder,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { hash } from "./xuanxue-ai-production-fixture.js";

export const acceptNamingJoinGuards = (
  runtime: XuanxueAiProductionRuntime,
  candidate: XuanxueAiProductionOrder,
  suffix: "nm01" | "nm02",
): void => {
  const invalid = (
    kind: string,
    joinParents: XuanxueAiProductionOrder["joinParents"],
  ): XuanxueAiProductionOrder => ({
    ...candidate,
    orderId: `aiprod_${suffix}_${kind}`,
    sourceTaskId: `source:aiprod_${suffix}_${kind}`,
    requestHash: hash(`aiprod_${suffix}_${kind}`),
    joinParents,
  });
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, invalid(
      "missing_aux_join",
      candidate.joinParents.slice(0, -1),
    )),
    /NAMING_TYPED_JOINS_INVALID/u,
    "every actual naming auxiliary must have exactly one private-base join",
  );
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, invalid(
      "duplicate_aux_join",
      [candidate.joinParents[0]!, candidate.joinParents[0]!],
    )),
    /TYPED_JOIN_PARENT_MISMATCH|NAMING_TYPED_JOINS_INVALID/u,
    "duplicate naming joins must fail before any provider work",
  );
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, invalid(
      "wrong_aux_role",
      candidate.joinParents.map((binding, index) => index === 0
        ? { ...binding, participantRoleCode: "unfrozen_role" }
        : binding),
    )),
    /TYPED_JOIN_PARENT_MISMATCH/u,
    "a naming join cannot change the frozen participant role",
  );
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, invalid(
      "wrong_aux_person",
      candidate.joinParents.map((binding, index) => index === 0
        ? { ...binding, personRef: "person:not-frozen-for-this-project" }
        : binding),
    )),
    /TYPED_JOIN_PARENT_MISMATCH/u,
    "a naming join cannot change the frozen participant person",
  );
};
