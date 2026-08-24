import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { Project } from "ts-morph";

import { submissionAdmissionBindingIsExact } from
  "../audit/domains/xuanxue-ai-production/inspect-submission-admission.js";
import { buildXuanxueAiSubmissionAdmission } from
  "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.js";

const hash = (value: string): `sha256:${string}` => `sha256:${value.repeat(64).slice(0, 64)}`;

const acceptCurrentGrantAndPriorityBinding = (): void => {
  const current = buildXuanxueAiSubmissionAdmission({
    identity: {
      jobId: "job-1",
      attemptId: "attempt-1",
      requiredDeviceId: "device-1",
      leaseVersion: 1,
      executionFenceHash: hash("a"),
      contractManifestHash: hash("b"),
      serverNow: "2026-08-24T00:00:00.000Z",
      leaseExpiresAt: "2026-08-24T00:01:30.000Z",
    },
    orderCreatedAt: "2026-08-24T00:00:00.000Z",
    orderId: "order-1",
    stageExecutionId: "execution-1",
    stageOrdinal: 2,
  });
  const freshGrant = buildXuanxueAiSubmissionAdmission({
    identity: {
      jobId: "job-1",
      attemptId: "attempt-2",
      requiredDeviceId: "device-1",
      leaseVersion: 2,
      executionFenceHash: hash("c"),
      contractManifestHash: hash("b"),
      serverNow: "2026-08-24T00:01:00.000Z",
      leaseExpiresAt: "2026-08-24T00:02:30.000Z",
    },
    orderCreatedAt: "2026-08-24T00:00:00.000Z",
    orderId: "order-1",
    stageExecutionId: "execution-1",
    stageOrdinal: 2,
  });
  assert.notEqual(
    freshGrant.admissionRef,
    current.admissionRef,
    "the same durable execution must receive a fresh admission hash from a fresh Cloud grant",
  );
  assert.equal(
    freshGrant.priorityKey,
    current.priorityKey,
    "a fresh Cloud grant must not change the durable task's oldest-first business priority",
  );
};

export const runXuanxueAdmissionInspectorAttacks = (): void => {
  acceptCurrentGrantAndPriorityBinding();
  const project = new Project({ useInMemoryFileSystem: true });
  const realSource = project.createSourceFile(
    "xuanxue-ai-production-stage-execution.ts",
    readFileSync(
      "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts",
      "utf8",
    ),
  );
  assert.equal(
    submissionAdmissionBindingIsExact(realSource),
    true,
    "the active current-grant admission dataflow must satisfy its semantic inspector",
  );

  const forged = project.createSourceFile("forged-stage-execution.ts", `
    const browserHash = (value: string) => value;
    const buildXuanxueAiSubmissionAdmission = (input: any) => {
      const priorityKey = "forged";
      const admissionRef = browserHash("caller-forged");
      return { admissionRef, priorityKey };
    };
    const acquireStageBrowser = async (input: any) => {
      const record = input.runtime.store.readOrder(input.orderId);
      const identity = record?.order.cloudExecutionIdentity;
      const submissionAdmission = buildXuanxueAiSubmissionAdmission({
        identity, orderCreatedAt: record.order.createdAt, orderId: record.order.orderId,
        stageExecutionId: input.stage.executionId, stageOrdinal: input.stage.ordinal,
      });
      return { submissionAdmission };
    };
    const executeGatewayStage = async (input: any) => {
      const { submissionAdmission } = await acquireStageBrowser(input);
      const callerSupplied = { admissionRef: "forged", priorityKey: "forged" };
      if (false) await input.runtime.aiInputGateway.execute(input.feedInput, { submissionAdmission });
      return input.runtime.aiInputGateway.execute(input.feedInput, { submissionAdmission: callerSupplied });
    };
  `);
  assert.equal(
    submissionAdmissionBindingIsExact(forged),
    false,
    "an unreachable compliant call plus caller-supplied effective admission must produce an enforcement failure",
  );
};
