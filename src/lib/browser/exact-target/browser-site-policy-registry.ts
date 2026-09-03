export type BrowserSitePolicy = Readonly<{
  siteId: "gpt-web" | "amazon";
  allowedOrigins: readonly string[];
}>;

export const GPT_WEB_ORIGIN = "https://chatgpt.com" as const;
export const GPT_WEB_START_URL = "https://chatgpt.com/" as const;

const policies: readonly BrowserSitePolicy[] = Object.freeze([
  {
    siteId: "gpt-web",
    allowedOrigins: [GPT_WEB_ORIGIN],
  },
  {
    siteId: "amazon",
    allowedOrigins: [
      "https://www.amazon.ae",
      "https://www.amazon.com",
      "https://sellercentral.amazon.ae",
      "https://sellercentral.amazon.com",
    ],
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

export const requireGptWebPolicyForUrl = (value: string): BrowserSitePolicy => {
  const policy = requireBrowserSitePolicyForUrl(value);
  if (policy.siteId !== "gpt-web") throw new Error("BROWSER_ORIGIN_REJECTED");
  return policy;
};

export const gptWebClaimOriginForUrl = (value: string): typeof GPT_WEB_ORIGIN => {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("BROWSER_ORIGIN_REJECTED"); }
  if (url.protocol !== "https:" || url.origin !== GPT_WEB_ORIGIN
    || url.username !== "" || url.password !== "") {
    throw new Error("BROWSER_ORIGIN_REJECTED");
  }
  return GPT_WEB_ORIGIN;
};

export const requireGptWebClaimOrigin = (value: string): typeof GPT_WEB_ORIGIN => {
  if (value !== GPT_WEB_ORIGIN) throw new Error("BROWSER_ORIGIN_REJECTED");
  return GPT_WEB_ORIGIN;
};
