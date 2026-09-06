import { executionFailure } from "../../../../lib/execution-failure.js";
import { durableCanonicalGptConversationUrl } from
  "../../../../lib/browser/infrastructure/browser-confirmed-readback-source.js";

const GPT_ORIGIN = "https://chatgpt.com" as const;
export const GPT_ROOT_URL = `${GPT_ORIGIN}/` as const;
export const GPT_CONVERSATION_SEGMENT_MAX_CHARS = 256;

export const canonicalGptConversationUrl = (value: string): string => {
  let url: URL;
  try { url = new URL(value); }
  catch { throw executionFailure("failed", "GPT_CONVERSATION_URL_INVALID"); }
  const segments = url.pathname.split("/");
  const segment = segments.length === 3 && segments[0] === "" && segments[1] === "c"
    ? segments[2]! : "";
  if (url.protocol !== "https:" || url.origin !== GPT_ORIGIN
    || url.username !== "" || url.password !== ""
    || url.search !== "" || url.hash !== ""
    || segment.length < 1 || segment.length > GPT_CONVERSATION_SEGMENT_MAX_CHARS) {
    throw executionFailure("failed", "GPT_CONVERSATION_URL_INVALID");
  }
  return `${url.origin}${url.pathname}`;
};

export const durableGptConversationUrl = (value: string): string => {
  const durable = durableCanonicalGptConversationUrl(value);
  if (!durable) throw executionFailure("failed", "GPT_DURABLE_CONVERSATION_URL_INVALID");
  return durable;
};

export const isGptRootUrl = (value: string): value is typeof GPT_ROOT_URL => value === GPT_ROOT_URL;
