import type { AiFeedInput } from "../schema.js";

type SubmitStageInput = {
  request: Pick<AiFeedInput, "providerKind" | "promptPackageId" | "promptContractId">;
};

type SubmitStageRefs = Record<string, string | number | boolean | null | undefined>;

const formatStageRefs = (refs: SubmitStageRefs): string =>
  Object.entries(refs)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

export const emitSubmitStage = (
  input: SubmitStageInput,
  stage: string,
  status: "start" | "success" | "fallback" | "failed",
  startedAtMs: number | null,
  refs: SubmitStageRefs = {},
): void => {
  const line = formatStageRefs({
    stage,
    status,
    providerKind: input.request.providerKind,
    promptPackageId: input.request.promptPackageId,
    promptContractId: input.request.promptContractId,
    elapsedMs: startedAtMs === null ? undefined : Date.now() - startedAtMs,
    ...refs,
  });
  process.stdout.write(`[GRASSEYE][AI-GATEWAY][WEB-CHAT] ${line}\n`);
};
