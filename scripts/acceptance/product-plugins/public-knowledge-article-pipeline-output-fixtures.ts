export const researchOutput = (decision: "proceed" | "decline") => ({
  schema_version: "public-knowledge-research-output.v3", decision,
  topic_manifest: {
    primary_question: "旺衰判断为何不能只数五行？", answer_scope: "解释判断条件",
    excluded_scope: "不做个人命盘", primary_cluster_id: "bazi-strength-balance",
    secondary_cluster_ids: [], reader_level: "introductory", concept_keys: ["旺衰"],
    relation_keys: ["条件"],
  },
  research_markdown: "研究工件", citations: [], research_claim_units: [],
});

export const articleOutput = () => ({
  schema_version: "public-knowledge-article-output.v3", title: "旺衰判断的条件",
  editor_note: "说明边界", article_markdown: "## 判断边界\n不能机械计数。",
  safety_notes: [],
});
