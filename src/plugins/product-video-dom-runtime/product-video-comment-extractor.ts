import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type { ProductVideoComment } from "./product-video-dom.schema.js";

const COMMENT_HINT = /(?:comment|评论|留言|buyer says|用户说)/iu;

export const extractProductVideoComments = (snapshot: DomSnapshot): ProductVideoComment[] => {
  const candidates = [
    ...snapshot.roleRows,
    ...snapshot.textBlocks,
    ...snapshot.genericClickableElements,
  ];
  const comments = candidates
    .map((item, index) => {
      const text = item.visibleText ?? item.nearbyText ?? "";
      if (!COMMENT_HINT.test(text)) return null;
      const cleaned = text.replace(/^(comment|评论|留言)\s*[:：-]?\s*/iu, "").trim();
      if (!cleaned) return null;
      return {
        commentId: `${item.selectorCandidate}:${index}`,
        commentText: cleaned.slice(0, 240),
      };
    })
    .filter((item): item is ProductVideoComment => item !== null);
  return comments.slice(0, 80);
};

export const extractCommentCountText = (snapshot: DomSnapshot): string | undefined => {
  const candidate = [
    ...snapshot.buttons,
    ...snapshot.textBlocks,
    ...snapshot.genericClickableElements,
  ].find((item) => /(?:comments?|评论)\s*[:：]?\s*[\d,.万千k]+|[\d,.万千k]+\s*(?:comments?|评论)/iu.test(item.visibleText ?? item.ariaLabel ?? item.nearbyText ?? ""));
  return candidate?.visibleText ?? candidate?.ariaLabel ?? candidate?.nearbyText;
};
