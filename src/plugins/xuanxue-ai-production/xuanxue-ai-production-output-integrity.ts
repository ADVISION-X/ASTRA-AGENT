const privateUseCharacter =
  /[\uE000-\uF8FF]|\p{Co}/u;
const providerCitationResidue =
  /(?:filecite|turn\d+file\d+|oaicite|contentReference)/iu;
const providerFailureAnswer =
  /^(?:\s|[`#*_>-])*(?:消息流中的错误(?:\s*重试)?|输入完整性校验失败|输入缺失(?:，|,|\s)*(?:无法|不能)(?:继续)?(?:解读|分析)|我(?:目前|现在)?(?:无法|不能)(?:访问|读取|看到|打开)(?:你|您)?(?:所)?(?:上传|提供)?的?(?:附件|文件)|未(?:检测到|找到|收到)(?:任何|所需|你|您)?(?:上传|提供)?的?(?:附件|文件))/iu;

export const xuanxueAiOutputIntegrityFailure = (
  rawResponseText: string,
): string | null => {
  if (rawResponseText.includes("\uFFFD")) {
    return "XUANXUE_AI_PRODUCTION_OUTPUT_REPLACEMENT_CHARACTER";
  }
  if (privateUseCharacter.test(rawResponseText)) {
    return "XUANXUE_AI_PRODUCTION_OUTPUT_PRIVATE_USE_CHARACTER";
  }
  if (providerCitationResidue.test(rawResponseText)) {
    return "XUANXUE_AI_PRODUCTION_OUTPUT_PROVIDER_CITATION_RESIDUE";
  }
  if (providerFailureAnswer.test(rawResponseText)) {
    return "XUANXUE_AI_PRODUCTION_OUTPUT_PROVIDER_FAILURE_ANSWER";
  }
  return null;
};

export const xuanxueAiOutputRequiresFreshExecution = (
  reason: string | null,
): boolean => Boolean(
  reason
  && (
    reason.startsWith("XUANXUE_AI_PRODUCTION_OUTPUT_")
    || reason === "XUANXUE_AI_PRODUCTION_RAW_RESPONSE_MISSING"
  )
);
