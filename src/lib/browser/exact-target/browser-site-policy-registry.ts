export type BrowserSitePolicy = Readonly<{
  siteId: "gpt-web-chat";
  allowedOrigins: readonly string[];
}>;

const policies: readonly BrowserSitePolicy[] = Object.freeze([
  {
    siteId: "gpt-web-chat",
    allowedOrigins: ["https://chatgpt.com"],
  },
]);

export const requireBrowserSitePolicyForUrl = (value: string): BrowserSitePolicy => {
  let origin: string;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("BROWSER_ORIGIN_REJECTED");
    origin = url.origin;
  } catch {
    throw new Error("BROWSER_ORIGIN_REJECTED");
  }
  const policy = policies.find((candidate) => candidate.allowedOrigins.includes(origin));
  if (!policy) throw new Error("BROWSER_ORIGIN_REJECTED");
  return policy;
};
