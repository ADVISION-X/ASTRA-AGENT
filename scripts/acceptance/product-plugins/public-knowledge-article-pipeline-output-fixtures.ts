export const researchOutput = (decision: "proceed" | "decline") => ({
  schema_version: "public-knowledge-research-output.v3", decision,
  topic_manifest: {
    primary_question: "旺衰判断为何不能只数五行？", answer_scope: "解释判断条件",
    excluded_scope: "不做个人命盘", primary_cluster_id: "bazi-strength-balance",
    secondary_cluster_ids: [], reader_level: "introductory", concept_keys: ["旺衰"],
    relation_keys: ["条件"],
  },
  research_markdown: "研究工件",
  citations: decision === "proceed" ? [{ citation_id: "S1", book_id: "book-1", locator: "第一节" }] : [],
  research_claim_units: [],
});

export const articleOutput = () => ({
  schema_version: "public-knowledge-article-output.v4", title: "旺衰判断的条件",
  editor_note: "说明边界", article_markdown: "## 判断边界\n不能机械计数。[S1]",
  safety_notes: [], verbatim_quotes: [{ text: "不能机械计数。", citation_ids: ["[S1]"] }],
});
