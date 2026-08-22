import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Project } from "ts-morph";

import { submissionAdmissionBindingIsExact } from
  "../audit/domains/xuanxue-ai-production/inspect-submission-admission.js";

export const runXuanxueAdmissionInspectorAttacks = (): void => {
  const project = new Project({ useInMemoryFileSystem: true });
  const realSource = project.createSourceFile(
    "xuanxue-ai-production-stage-execution.ts",
    readFileSync(
      "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts",
      "utf8",
    ),
  );
  assert.equal(submissionAdmissionBindingIsExact(realSource), true,
    "the active current-grant admission dataflow must satisfy its semantic inspector");

  const forged = project.createSourceFile("forged-stage-execution.ts", `
    const browserHash = (value: string) => value;
    const buildXuanxueAiSubmissionAdmission = (input: any) => {
      const priorityKey = "forged";
      const jobId = input.identity.jobId;
      const attemptId = input.identity.attemptId;
      const requiredDeviceId = input.identity.requiredDeviceId;
      const leaseVersion = input.identity.leaseVersion;
      const executionFenceHash = input.identity.executionFenceHash;
      const contractManifestHash = input.identity.contractManifestHash;
      const stageExecutionId = input.stageExecutionId;
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
  assert.equal(submissionAdmissionBindingIsExact(forged), false,
    "an unreachable compliant call plus caller-supplied effective admission must produce an enforcement failure");
};
