const REQUEST_PROTOCOL = "xuanxue-agent-codex-handoff-v1";
const STATUS_PROTOCOL = "xuanxue-agent-codex-status-v1";
const RECEIPT_PROTOCOL = "xuanxue-agent-codex-receipt-v1";
const REQUESTER_REPO = "/Users/nexgen/Documents/xuanxue-web";
const TARGET_REPO = "/Users/nexgen/Documents/AGENT";
const REQUEST_ID_PATTERN = /^XAH-\d{8}T\d{6}Z-[a-f0-9]{8}$/u;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const SECRET_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:api[_ -]?key|access[_ -]?token|password|cookie|session[_ -]?token)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/iu,
];
const BYPASS_PATTERNS = [
  /(?:跳过|绕过|忽略|关闭|禁用).{0,16}(?:法案|权威|AGENTS?\.md|CI(?:-FULL|:full)?|审计|验收|Chrome|provider|浏览器)/iu,
  /(?:无需|不用|不必|不要).{0,16}(?:运行|执行|通过)?\s*(?:法案|权威|AGENTS?\.md|CI(?:-FULL|:full)?|审计|验收|Chrome|provider|浏览器)/iu,
  /\b(?:skip|bypass|ignore|disable)\b.{0,24}\b(?:law|authority|AGENTS?\.md|CI|audit|acceptance|chrome|provider)\b/iu,
];
const NEGATED_AUTHORIZATION_PATTERN = /(?:不|未|没有|无)(?:予以|明确)?(?:授权|允许|同意)|(?:不|禁止|不得|不准|不可)(?:修改|变更|提交|推送|发布)|\b(?:not|never|without)\b.{0,16}\b(?:authorize|allow|approve|edit|change|commit|push|release)\b/iu;

export class ContractError extends Error {}

const fail = (message) => {
  throw new ContractError(message);
};

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value, label) => {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
};

const requireString = (record, key) => {
  if (typeof record[key] !== "string" || record[key].trim() === "") {
    fail(`${key} must be a non-empty string`);
  }
};

const requireNullableString = (record, key) => {
  if (
    record[key] !== null
    && (typeof record[key] !== "string" || record[key].trim() === "")
  ) fail(`${key} must be null or a non-empty string`);
};

const requireBoolean = (record, key) => {
  if (typeof record[key] !== "boolean") fail(`${key} must be boolean`);
};

const requireArray = (record, key) => {
  if (!Array.isArray(record[key])) fail(`${key} must be an array`);
};

const requireNonEmptyArray = (record, key) => {
  requireArray(record, key);
  if (record[key].length === 0) fail(`${key} must not be empty`);
};

const requireStringArray = (record, key, { nonEmpty = false } = {}) => {
  if (nonEmpty) requireNonEmptyArray(record, key);
  else requireArray(record, key);
  if (record[key].some((item) => typeof item !== "string" || item.trim() === "")) {
    fail(`${key} must contain only non-empty strings`);
  }
};

const requireEnum = (record, key, allowed) => {
  if (!allowed.includes(record[key])) {
    fail(`${key} must be one of ${allowed.join(", ")}`);
  }
};

const requireExactKeys = (record, keys, label) => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) fail(`${label} keys differ; expected ${expected.join(", ")}`);
};

const collectStrings = (value, output = []) => {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
  return output;
};

const rejectSecrets = (record) => {
  for (const value of collectStrings(record)) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
      fail("payload contains secret-like material");
    }
  }
};

const rejectBypassDirectives = (values) => {
  for (const value of collectStrings(values)) {
    if (BYPASS_PATTERNS.some((pattern) => pattern.test(value))) {
      fail("request contains an authority or verification bypass directive");
    }
  }
};

const rejectWebsiteWriteScope = (values, label) => {
  for (const value of collectStrings(values)) {
    if (
      value.includes(REQUESTER_REPO)
      || /(?:修改|写入|删除|重构|edit|write|delete|refactor).{0,24}xuanxue-web/iu.test(value)
      || /xuanxue-web.{0,24}(?:修改|写入|删除|重构|edit|write|delete|refactor)/iu.test(value)
      || /(?:修改|写入|删除|重构|edit|write|delete|refactor).{0,16}(?:请求方|网站侧|网站仓库|requester)(?:仓库|repo(?:sitory)?)?/iu.test(value)
    ) fail(`${label} requests a website-repository write`);
  }
};

const validateAgentPathArray = (record, key) => {
  requireStringArray(record, key);
  for (const value of record[key]) {
    const normalized = value.replaceAll("\\", "/");
    if (
      normalized.includes(REQUESTER_REPO)
      || normalized.includes("/xuanxue-web/")
      || normalized === "xuanxue-web"
      || normalized.split("/").includes("..")
      || (normalized.startsWith("/") && !normalized.startsWith(`${TARGET_REPO}/`))
    ) fail(`${key} contains a path outside the AGENT repository`);
  }
};

const validateIdentity = (record) => {
  requireString(record, "request_id");
  if (!REQUEST_ID_PATTERN.test(record.request_id)) {
    fail("request_id must match XAH-YYYYMMDDTHHMMSSZ-8hex");
  }
};

const validateAuthorityEvidence = (record) => {
  requireNullableString(record, "law_change_authority_verbatim");
  requireNullableString(record, "release_authority_verbatim");
  if (record.law_change_authorized) {
    const evidence = record.law_change_authority_verbatim;
    if (
      typeof evidence !== "string"
      || !record.user_authority_verbatim.includes(evidence)
      || NEGATED_AUTHORIZATION_PATTERN.test(evidence)
      || !/(?:法案|law)/iu.test(evidence)
      || !/(?:授权|允许|同意|修改|变更|authorize|allow|edit|change)/iu.test(evidence)
    ) fail("law-change authorization lacks a specific verbatim quote");
  } else if (record.law_change_authority_verbatim !== null) {
    fail("law_change_authority_verbatim must be null when unauthorized");
  }
  if (record.release_authorized) {
    const evidence = record.release_authority_verbatim;
    if (
      typeof evidence !== "string"
      || !record.user_authority_verbatim.includes(evidence)
      || NEGATED_AUTHORIZATION_PATTERN.test(evidence)
      || !/(?:提交|推送|发布|commit|push|release)/iu.test(evidence)
      || !/(?:授权|允许|同意|可以|执行|authorize|allow|approve)/iu.test(evidence)
    ) fail("release authorization lacks a specific verbatim quote");
  } else if (record.release_authority_verbatim !== null) {
    fail("release_authority_verbatim must be null when unauthorized");
  }
};

const validateEvidence = (record) => {
  requireArray(record, "website_evidence");
  for (const [index, item] of record.website_evidence.entries()) {
    const evidence = requireRecord(item, `website_evidence[${index}]`);
    requireExactKeys(evidence, ["ref", "fact"], `website_evidence[${index}]`);
    requireString(evidence, "ref");
    requireString(evidence, "fact");
  }
};

const validateVerificationRequirements = (record) => {
  const requirements = requireRecord(
    record.verification_requirements,
    "verification_requirements",
  );
  requireExactKeys(
    requirements,
    ["ci_full", "chrome", "external_runtime"],
    "verification_requirements",
  );
  if (requirements.ci_full !== "REQUIRED") {
    fail("verification_requirements.ci_full must be REQUIRED");
  }
  for (const key of ["chrome", "external_runtime"]) {
    requireEnum(requirements, key, ["REQUIRED", "NOT_APPLICABLE"]);
  }
};

export const validateRequest = (record) => {
  const keys = [
    "protocol",
    "request_id",
    "attempt",
    "requester_repo",
    "target_repo",
    "user_request_verbatim",
    "user_authority_verbatim",
    "law_change_authority_verbatim",
    "release_authority_verbatim",
    "goal",
    "business_reason",
    "website_evidence",
    "allowed_scope",
    "forbidden_scope",
    "acceptance",
    "verification_requirements",
    "law_change_authorized",
    "release_authorized",
    "secrets_included",
    "expected_receipt",
  ];
  requireExactKeys(record, keys, "request");
  validateIdentity(record);
  if (record.protocol !== REQUEST_PROTOCOL) fail("request protocol mismatch");
  if (record.requester_repo !== REQUESTER_REPO) fail("requester_repo mismatch");
  if (record.target_repo !== TARGET_REPO) fail("target_repo mismatch");
  if (!Number.isInteger(record.attempt) || record.attempt < 1) {
    fail("attempt must be a positive integer");
  }
  for (const key of [
    "user_request_verbatim",
    "user_authority_verbatim",
    "goal",
    "business_reason",
  ]) requireString(record, key);
  requireStringArray(record, "allowed_scope", { nonEmpty: true });
  requireStringArray(record, "forbidden_scope", { nonEmpty: true });
  requireStringArray(record, "acceptance", { nonEmpty: true });
  for (const key of [
    "law_change_authorized",
    "release_authorized",
    "secrets_included",
  ]) requireBoolean(record, key);
  if (record.secrets_included !== false) fail("secrets_included must be false");
  if (record.expected_receipt !== RECEIPT_PROTOCOL) {
    fail("expected_receipt mismatch");
  }
  validateAuthorityEvidence(record);
  validateEvidence(record);
  validateVerificationRequirements(record);
  rejectSecrets(record);
  rejectWebsiteWriteScope(record.allowed_scope, "allowed_scope");
  rejectBypassDirectives([
    record.user_request_verbatim,
    record.goal,
    record.business_reason,
    record.allowed_scope,
    record.acceptance,
  ]);
  return record;
};

export const validateStatus = (record, request) => {
  const keys = [
    "protocol",
    "request_id",
    "status",
    "current_phase",
    "summary",
    "question_for_user",
  ];
  requireExactKeys(record, keys, "status");
  validateIdentity(record);
  if (record.request_id !== request.request_id) fail("status request_id mismatch");
  if (record.protocol !== STATUS_PROTOCOL) fail("status protocol mismatch");
  requireEnum(record, "status", [
    "accepted",
    "in_progress",
    "needs_user",
    "blocked",
  ]);
  requireEnum(record, "current_phase", [
    "authority",
    "implementation",
    "verification",
    "release",
  ]);
  requireString(record, "summary");
  requireNullableString(record, "question_for_user");
  if (record.status === "needs_user" && record.question_for_user === null) {
    fail("needs_user status requires question_for_user");
  }
  if (
    ["accepted", "in_progress"].includes(record.status)
    && record.question_for_user !== null
  ) fail(`${record.status} status must not include question_for_user`);
  rejectSecrets(record);
};

const validateWebsiteChangeRequests = (record) => {
  requireArray(record, "website_change_request");
  for (const [index, item] of record.website_change_request.entries()) {
    const request = requireRecord(item, `website_change_request[${index}]`);
    requireExactKeys(
      request,
      ["target_repo", "target", "reason", "public_contract_impact", "acceptance"],
      `website_change_request[${index}]`,
    );
    if (request.target_repo !== REQUESTER_REPO) {
      fail(`website_change_request[${index}].target_repo mismatch`);
    }
    for (const key of ["target", "reason", "public_contract_impact"]) {
      requireString(request, key);
    }
    requireStringArray(request, "acceptance", { nonEmpty: true });
  }
};

const validateWorktreeIdentity = (value) => {
  const identity = requireRecord(value, "worktree_identity");
  requireExactKeys(
    identity,
    ["project_root", "worktree_path", "git_common_dir", "task_id"],
    "worktree_identity",
  );
  for (const key of ["project_root", "worktree_path", "git_common_dir", "task_id"]) {
    requireString(identity, key);
  }
  if (identity.project_root !== TARGET_REPO) {
    fail("worktree_identity.project_root mismatch");
  }
  if (
    !identity.worktree_path.startsWith("/")
    || identity.worktree_path === TARGET_REPO
    || identity.worktree_path.includes(REQUESTER_REPO)
    || identity.worktree_path.split("/").includes("..")
  ) fail("worktree_identity.worktree_path is not an independent AGENT worktree");
  if (identity.git_common_dir !== `${TARGET_REPO}/.git`) {
    fail("worktree_identity.git_common_dir does not bind the AGENT repository");
  }
};

export const validateReceipt = (record, request) => {
  const keys = [
    "protocol",
    "request_id",
    "decision",
    "starting_sha",
    "final_sha",
    "branch",
    "worktree_identity",
    "authority_read",
    "changed_files",
    "checked_not_changed",
    "law_change_performed",
    "second_chain_check",
    "generated_artifact_rule",
    "secret_boundary",
    "verification",
    "release",
    "worktree_clean",
    "website_change_request",
    "remaining_items",
    "final_statement",
  ];
  requireExactKeys(record, keys, "receipt");
  validateIdentity(record);
  if (record.request_id !== request.request_id) fail("receipt request_id mismatch");
  if (record.protocol !== RECEIPT_PROTOCOL) fail("receipt protocol mismatch");
  requireEnum(record, "decision", [
    "completed",
    "incomplete",
    "blocked",
    "rejected",
  ]);
  for (const key of [
    "starting_sha",
    "final_sha",
    "branch",
    "final_statement",
  ]) requireString(record, key);
  validateWorktreeIdentity(record.worktree_identity);
  if (!SHA_PATTERN.test(record.starting_sha) || !SHA_PATTERN.test(record.final_sha)) {
    fail("starting_sha and final_sha must be 40 lowercase hex");
  }
  requireStringArray(record, "authority_read");
  validateAgentPathArray(record, "changed_files");
  validateAgentPathArray(record, "checked_not_changed");
  requireStringArray(record, "remaining_items");
  validateWebsiteChangeRequests(record);
  requireBoolean(record, "law_change_performed");
  requireBoolean(record, "worktree_clean");
  if (record.law_change_performed && !request.law_change_authorized) {
    fail("receipt reports an unauthorized active-law change");
  }
  for (const key of [
    "second_chain_check",
    "generated_artifact_rule",
    "secret_boundary",
  ]) requireEnum(record, key, ["PASS", "FAIL"]);

  const verification = requireRecord(record.verification, "verification");
  requireExactKeys(
    verification,
    ["targeted", "ci_full", "chrome", "external_runtime"],
    "verification",
  );
  requireStringArray(verification, "targeted");
  requireEnum(verification, "ci_full", ["PASS", "FAIL", "NOT_RUN"]);
  requireEnum(
    verification,
    "chrome",
    ["PASS", "FAIL", "NOT_REQUIRED", "NOT_RUN"],
  );
  requireEnum(
    verification,
    "external_runtime",
    ["PASS", "FAIL", "NOT_REQUIRED", "NOT_RUN"],
  );

  const release = requireRecord(record.release, "release");
  requireExactKeys(
    release,
    ["authorized", "committed", "pushed", "remote_sha"],
    "release",
  );
  for (const key of ["authorized", "committed", "pushed"]) {
    requireBoolean(release, key);
  }
  if (release.authorized !== request.release_authorized) {
    fail("receipt release authorization differs from the request");
  }
  if (release.remote_sha !== null && !SHA_PATTERN.test(release.remote_sha)) {
    fail("release.remote_sha must be null or 40 lowercase hex");
  }
  if (!release.authorized && (
    release.committed
    || release.pushed
    || release.remote_sha !== null
  )) fail("unauthorized release contains commit, push, or remote SHA facts");
  if (release.pushed && (!release.committed || release.remote_sha === null)) {
    fail("pushed release must also be committed and have a remote SHA");
  }

  rejectSecrets(record);

  if (record.decision === "completed") {
    const requirements = request.verification_requirements;
    const expectedChrome = requirements.chrome === "REQUIRED" ? "PASS" : "NOT_REQUIRED";
    const expectedExternal = requirements.external_runtime === "REQUIRED"
      ? "PASS"
      : "NOT_REQUIRED";
    if (
      verification.targeted.length === 0
      || verification.ci_full !== "PASS"
      || verification.chrome !== expectedChrome
      || verification.external_runtime !== expectedExternal
      || ["second_chain_check", "generated_artifact_rule", "secret_boundary"]
        .some((key) => record[key] !== "PASS")
      || record.remaining_items.length !== 0
    ) fail("completed receipt does not satisfy the request completion gate");
    if (
      release.authorized
      && (
        !release.committed
        || !release.pushed
        || release.remote_sha !== record.final_sha
        || !record.worktree_clean
      )
    ) fail("authorized release is not closed");
  }
};

export const parseJson = (raw, label) => {
  try {
    return requireRecord(JSON.parse(raw), label);
  } catch (error) {
    if (error instanceof ContractError) throw error;
    fail(`invalid ${label} JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};
