const allowedHost = (host: string): boolean =>
  host === "chatgpt.com" ||
  host === "chat.openai.com" ||
  host === "gemini.google.com" ||
  host === "127.0.0.1" ||
  host === "localhost" ||
  host === "amazon.com" ||
  host.endsWith(".amazon.com") ||
  host === "amazon.ae" ||
  host.endsWith(".amazon.ae") ||
  host === "facebook.com" ||
  host.endsWith(".facebook.com");

export const assertAllowedUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TARGET_ORIGIN_MISMATCH:invalid target URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("TARGET_ORIGIN_MISMATCH:target scheme is not approved");
  }
  if (!allowedHost(url.hostname)) {
    throw new Error("TARGET_ORIGIN_MISMATCH:target host is not approved");
  }
  if (
    url.protocol === "http:" &&
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost"
  ) {
    throw new Error(
      "TARGET_ORIGIN_MISMATCH:plain HTTP is allowed only for local test targets",
    );
  }
  return url;
};

export const sameOrigin = (left: string, right: string): boolean => {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
};
