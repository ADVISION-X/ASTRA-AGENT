import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type {
  ProductVideoComment,
  ProductVideoCommentDetail,
} from "./product-video-dom.schema.js";

const COMMENT_HINT = /(?:comment|评论|留言|buyer says|用户说)/iu;
const COMMENT_COUNT_PATTERN = /(?:comments?|评论)\s*[:：]?\s*[\d,.万千k]+|[\d,.万千k]+\s*(?:comments?|评论)/iu;

const COMMENT_AUTHOR_HINT = /^(@[^\s:：-]+|[^:：-]{1,30})\s*[:：-]\s*/u;

const extractCommentText = (value: string): string | null => {
  const cleaned = value.replace(/^(comment|评论|留言)\s*[:：-]?\s*/iu, "").trim();
  return cleaned ? cleaned.slice(0, 240) : null;
};

const extractCommentAuthorText = (value: string): string | null => {
  const matched = value.match(COMMENT_AUTHOR_HINT)?.[1]?.trim();
  return matched || null;
};

const collectCommentCandidates = (snapshot: DomSnapshot) => [
  ...snapshot.roleRows,
  ...snapshot.textBlocks,
  ...snapshot.genericClickableElements,
  ...snapshot.tableRows,
];

export const extractProductVideoComments = (snapshot: DomSnapshot): ProductVideoComment[] => {
  const comments: ProductVideoComment[] = [];
  collectCommentCandidates(snapshot).forEach((item, index) => {
    const text = item.visibleText ?? item.nearbyText ?? "";
    if (!COMMENT_HINT.test(text)) {
      return;
    }
    const cleaned = extractCommentText(text);
    if (!cleaned) {
      return;
    }
    comments.push({
      commentId: `${item.selectorCandidate}:${index}`,
      ...(extractCommentAuthorText(text) ? { authorText: extractCommentAuthorText(text) ?? undefined } : {}),
      commentText: cleaned,
    });
  });
  return comments.slice(0, 80);
};

export const extractProductVideoCommentDetails = (
  snapshot: DomSnapshot,
): ProductVideoCommentDetail[] => extractProductVideoComments(snapshot)
  .map((comment) => ({
    text: comment.commentText,
    authorText: comment.authorText ?? null,
    likesText: null,
    capturedAt: new Date().toISOString(),
  }))
  .slice(0, 80);

export const sampleProductVideoComments = (
  snapshot: DomSnapshot,
  limit = 6,
): string[] => extractProductVideoComments(snapshot)
  .map((comment) => comment.commentText)
  .filter(Boolean)
  .slice(0, limit);

export const extractCommentCountText = (snapshot: DomSnapshot): string | undefined => {
  const candidates = [
    ...snapshot.buttons.map((item) => [item.visibleText, item.ariaLabel, item.nearbyText]),
    ...snapshot.genericClickableElements.map((item) => [item.visibleText, item.ariaLabel, item.nearbyText]),
    ...snapshot.links.map((item) => [item.visibleText, item.ariaLabel, item.nearbyText]),
    ...snapshot.textBlocks.map((item) => [item.visibleText, item.ariaLabel]),
  ];
  for (const fields of candidates) {
    const matched = fields.find((field) => COMMENT_COUNT_PATTERN.test(field ?? ""));
    if (matched) {
      return matched;
    }
  }
  return undefined;
};
