export const FACEBOOK_LOGIN_BLOCKER_PATTERNS = [
  /log\s*in/iu,
  /sign\s*in/iu,
  /join\s*facebook/iu,
  /continue\s*to\s*facebook/iu,
];

export const FACEBOOK_SECURITY_BLOCKER_PATTERNS = [
  /captcha/iu,
  /two[- ]?factor/iu,
  /2fa/iu,
  /verification\s*code/iu,
  /security\s*check/iu,
  /confirm\s*it'?s\s*you/iu,
];

export const FACEBOOK_RATE_LIMIT_PATTERNS = [
  /try\s*again\s*later/iu,
  /too\s*many\s*requests/iu,
  /temporarily\s*blocked/iu,
  /rate\s*limit/iu,
];

export const FACEBOOK_COMMENT_ENTRY_PATTERNS = [
  /comment/iu,
  /comments/iu,
  /评论/u,
];

export const FACEBOOK_COMMENT_EXPANSION_PATTERNS = [
  /see\s*more\s*comments/iu,
  /view\s*more\s*comments/iu,
  /more\s*comments/iu,
  /view\s*replies/iu,
  /see\s*more\s*replies/iu,
  /see\s*more$/iu,
  /查看更多评论/u,
  /查看更多回复/u,
  /^展开$/u,
];

export const FACEBOOK_MORE_MENU_PATTERNS = [
  /more/iu,
  /actions/iu,
  /options/iu,
  /更多/u,
  /菜单/u,
];

export const FACEBOOK_NOT_INTERESTED_PATTERNS = [
  /not\s*interested/iu,
  /hide\s*reel/iu,
  /hide\s*video/iu,
  /see\s*less/iu,
  /show\s*less/iu,
  /不感兴趣/u,
  /隐藏/u,
  /减少此类内容/u,
];

export const FACEBOOK_NEXT_VIDEO_PATTERNS = [
  /next/iu,
  /up\s*next/iu,
  /next\s*video/iu,
  /下一条/u,
  /下一个/u,
];

export const FACEBOOK_LIKE_PATTERNS = [
  /like/iu,
  /likes/iu,
  /赞/u,
  /喜欢/u,
];

export const FACEBOOK_SHARE_PATTERNS = [
  /share/iu,
  /shares/iu,
  /分享/u,
];
