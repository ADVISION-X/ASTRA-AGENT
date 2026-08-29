import { executionFailure } from "../../typed-failure.js";

export const productionCloudFetch = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch (cause) {
    throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE", { cause });
  }
};
