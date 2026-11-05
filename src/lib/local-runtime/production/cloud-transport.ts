import { executionFailure } from "../../execution-failure.js";

export const productionCloudFetch = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, { ...init, redirect: "error" });
  } catch (cause) {
    throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE", { cause });
  }
};
