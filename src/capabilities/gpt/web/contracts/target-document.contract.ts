import { executionFailure } from "../../../../lib/typed-failure.js";

export const GPT_ORIGIN = "https://chatgpt.com" as const;
export const GPT_ROOT_URL = `${GPT_ORIGIN}/` as const;
export const canonicalGptConversationUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.host !== "chatgpt.com"
    || !/^\/c\/(?!WEB:)[^/]+$/u.test(url.pathname)) {
    throw executionFailure("review_required", "GPT_CONVERSATION_URL_INVALID");
  }
  return `${url.origin}${url.pathname}`;
};

export const assertGptUrl = (value: string): URL => {
  const url = new URL(value);
  if (url.origin !== GPT_ORIGIN) throw executionFailure("review_required", "GPT_DOCUMENT_ORIGIN_INVALID");
  return url;
};
