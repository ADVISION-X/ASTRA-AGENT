export const AMAZON_TARGET_MARKET_CANONICAL_UAE = "united-arab-emirates";

const UAE_TARGET_MARKET_ALIASES = [
  "uae",
  "united arab emirates",
  "阿联酋",
] as const;

const KEYWORD_DROP_TOKENS = [
  "for",
  "the",
  "and",
  "with",
  "organizer",
  "organizers",
  "storage",
  "holder",
  "rack",
] as const;

const normalizeSpaces = (value: string): string =>
  value.toLowerCase().split(" ").filter((part) => part.length > 0).join(" ").trim();

export const normalizeAmazonTargetMarketKey = (targetMarket: string): string => {
  const normalized = normalizeSpaces(targetMarket);
  if (UAE_TARGET_MARKET_ALIASES.some((alias) => normalized.includes(alias))) {
    return AMAZON_TARGET_MARKET_CANONICAL_UAE;
  }
  return normalized;
};

export const normalizeAmazonKeywordText = (keyword: string): string =>
  normalizeSpaces(keyword);

const singularizeKeywordToken = (token: string): string =>
  token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token;

const keywordTokens = (keyword: string): string[] =>
  normalizeAmazonKeywordText(keyword)
    .split(" ")
    .map(singularizeKeywordToken)
    .filter((token) => token.length > 1);

const coreKeywordTokens = (keyword: string): string[] =>
  keywordTokens(keyword).filter((token) => !KEYWORD_DROP_TOKENS.includes(token as typeof KEYWORD_DROP_TOKENS[number]));

const tokenSetContainsAll = (candidateTokens: readonly string[], historicalTokens: readonly string[]): boolean => {
  const candidateTokenSet = new Set(candidateTokens);
  return historicalTokens.length > 0 && historicalTokens.every((token) => candidateTokenSet.has(token));
};

const isNearDuplicateKeyword = (candidate: string, historicalKeyword: string): boolean => {
  const candidateNormalized = normalizeAmazonKeywordText(candidate);
  const historicalNormalized = normalizeAmazonKeywordText(historicalKeyword);
  if (candidateNormalized === historicalNormalized) {
    return true;
  }
  const historicalTokens = keywordTokens(historicalKeyword);
  if (historicalTokens.length >= 2 && tokenSetContainsAll(keywordTokens(candidate), historicalTokens)) {
    return true;
  }
  const historicalCoreTokens = coreKeywordTokens(historicalKeyword);
  return historicalCoreTokens.length >= 2 && tokenSetContainsAll(coreKeywordTokens(candidate), historicalCoreTokens);
};

export const hasNearDuplicateAmazonKeyword = (
  candidate: string,
  historicalKeywords: readonly string[],
): boolean => historicalKeywords.some((historicalKeyword) => isNearDuplicateKeyword(candidate, historicalKeyword));
