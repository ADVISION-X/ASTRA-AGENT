import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { freezeSeoFlow } from "./seo-report-revisions.mjs";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const PINNED_ARCHIVE_HASH = "sha256:1fb581c0c09fe7ff83e94b98a4c5a49fc6f0c7dff216651caea137feece5772a";
const PINNED_TASK_ENVELOPE_HASH = "sha256:ca065f369dd8981c031297d1f8b874fe81c9b8f8a8770015a156357793f38506";
const PINNED_PUBLIC_SOURCE_HASH = "sha256:12005ef66e7e4a3967caa972d600418d8fa51715bdec459dbe42af11fc9c40cf";
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stable(value[key])])) : value;
export const seoSourceInputHash = (publicSource) => sha(JSON.stringify(stable(publicSource)));
const die = (code) => { throw new Error(code); };
const admitted = new WeakSet();
export function assertSeoSourceAdmission(candidate, publicSource) {
  if (!candidate || !admitted.has(candidate)
    || JSON.stringify(stable(candidate.publicSource)) !== JSON.stringify(stable(publicSource))) {
    die("SEO_LIVE_SOURCE_NOT_READ_BACK");
  }
  return true;
}

export async function loadSeoSourceFromCliArgs(args, repo) {
  if (args["pinned-source"]) {
    if (["website-repo", "runtime-db", "task-root", "job-id"].some((key) => args[key])) {
      die("SEO_SOURCE_MODES_CONFLICT");
    }
    return loadPinnedSeoSource({ repo, pinnedDir: args["pinned-source"] });
  }
  for (const key of ["website-repo", "runtime-db", "task-root", "job-id"]) {
    if (typeof args[key] !== "string" || !args[key]) die(`SEO_SOURCE_ARG_REQUIRED:${key}`);
  }
  if (!process.env.SEO_WEBSITE_CONNECTION_STRING) die("SEO_WEBSITE_CONNECTION_REQUIRED");
  return loadSeoLiveSource({ repo, websiteRepo: args["website-repo"],
    websiteConnectionString: process.env.SEO_WEBSITE_CONNECTION_STRING,
    runtimeDb: args["runtime-db"], taskRoot: args["task-root"], jobId: args["job-id"] });
}

/** Reuse a package whose Website, object-store and AGENT bytes were verified once. */
export async function loadPinnedSeoSource({ repo, pinnedDir }) {
  const folder = resolve(pinnedDir);
  const snapshot = JSON.parse(await readFile(join(folder, "seo-source-snapshot.json"), "utf8"));
  if (snapshot?.schemaVersion !== "gpt-page-seo-pinned-source.v1"
    || snapshot.asset !== "公开知识生产资料.zip"
    || snapshot.taskAsset !== "seo-task-envelope.json"
    || snapshot.task?.product_id !== "public_knowledge_article_pipeline"
    || snapshot.task?.action_id !== "produce_article"
    || snapshot.publicSource?.sourceKind !== "LIVE_SEO_CAPTURE_SESSION_INPUT"
    || snapshot.publicSource.productId !== snapshot.task.product_id
    || snapshot.publicSource.actionId !== snapshot.task.action_id
    || snapshot.publicSource.jobIdHash !== sha(snapshot.task.job_id)
    || snapshot.publicSource.requestHash !== snapshot.task.request_hash
    || seoSourceInputHash(snapshot.publicSource) !== PINNED_PUBLIC_SOURCE_HASH
    || snapshot.publicSource.archiveHash !== PINNED_ARCHIVE_HASH
    || snapshot.publicSource.taskEnvelopeHash !== PINNED_TASK_ENVELOPE_HASH
    || !Array.isArray(snapshot.verifiedAgainst)
    || snapshot.verifiedAgainst.length !== 5) die("SEO_PINNED_SOURCE_INVALID");
  const taskJson = await readFile(join(folder, snapshot.taskAsset), "utf8");
  const originalTask = JSON.parse(taskJson);
  if (sha(taskJson) !== PINNED_TASK_ENVELOPE_HASH
    || JSON.stringify(stable(snapshot.task)) !== JSON.stringify(stable({
      job_id: originalTask.job_id, product_id: originalTask.product_id,
      action_id: originalTask.action_id, request_hash: originalTask.request_hash,
      parameters: originalTask.parameters, material_refs: originalTask.material_refs,
    }))) die("SEO_PINNED_TASK_ENVELOPE_MISMATCH");
  const archiveBytes = await readFile(join(folder, snapshot.asset));
  if (archiveBytes.length !== snapshot.publicSource.archiveBytes
    || sha(archiveBytes) !== snapshot.publicSource.archiveHash
    || snapshot.task.material_refs?.length !== 1
    || snapshot.task.material_refs[0].sha256 !== snapshot.publicSource.archiveHash
    || snapshot.task.material_refs[0].bytes !== archiveBytes.length) {
    die("SEO_PINNED_ARCHIVE_MISMATCH");
  }
  const catalog = JSON.parse(await readFile(join(resolve(repo),
    "src/lib/local-runtime/production/website-agent-route-policies.v1.json"), "utf8"));
  const routes = catalog.routes.filter((route) => route.product_id === snapshot.task.product_id
    && route.action_id === snapshot.task.action_id);
  if (routes.length !== 1) die("SEO_PINNED_ROUTE_INVALID");
  const currentHashes = Object.fromEntries(await Promise.all(Object.keys(snapshot.publicSource.sourceHashes ?? {})
    .map(async (path) => [path, sha(await readFile(join(resolve(repo), path)))])));
  if (JSON.stringify(currentHashes) !== JSON.stringify(snapshot.publicSource.sourceHashes)
    || Object.entries(freezeSeoFlow().productSourceHashes).some(([path, hash]) =>
      currentHashes[path] !== hash)) die("SEO_PINNED_SOURCE_CODE_DRIFT");
  const result = { task: snapshot.task, route: routes[0], archiveBytes,
    publicSource: snapshot.publicSource };
  admitted.add(result);
  return result;
}

/** Read-only admission of one real Website SEO job and the same AGENT durable task. */
export async function loadSeoLiveSource({ repo, websiteRepo, websiteConnectionString,
  runtimeDb, taskRoot, jobId }) {
  if (!websiteConnectionString || !/^[A-Za-z0-9_-]+$/u.test(jobId ?? "")) die("SEO_SOURCE_ARGUMENT_INVALID");
  const websiteRoot = resolve(websiteRepo);
  const requireWebsite = createRequire(join(websiteRoot, "package.json"));
  const { Client } = requireWebsite("pg");
  const client = new Client({ connectionString: websiteConnectionString });
  await client.connect();
  let job, bindings;
  try {
    await client.query("begin read only");
    const rows = await client.query(`select job_id,request_hash,product_id,action_id,parameters_json,material_refs_json
      from ai_production_jobs where job_id=$1`, [jobId]);
    if (rows.rowCount !== 1) die("SEO_WEBSITE_JOB_MISSING");
    job = rows.rows[0];
    bindings = (await client.query(`select m.material_id,m.ordinal,m.role,m.display_name,m.object_ref,
      m.sha256,m.byte_count,m.media_type,m.storage_class,m.material_blob_id,
      b.canonical_object_ref,b.sha256 as blob_sha256,b.byte_count as blob_byte_count
      from ai_production_job_materials m left join ai_production_material_blobs b
        on b.material_blob_id=m.material_blob_id where m.job_id=$1 order by m.ordinal`, [jobId])).rows;
    await client.query("commit");
  } catch (error) { await client.query("rollback").catch(() => {}); throw error; }
  finally { await client.end(); }
  if (job.product_id !== "public_knowledge_article_pipeline" || job.action_id !== "produce_article"
    || bindings.length !== 1 || bindings[0].role !== "ready_corpus_archive") die("SEO_WEBSITE_ROUTE_INVALID");
  const db = new DatabaseSync(resolve(runtimeDb), { readOnly: true });
  let agent;
  try { agent = db.prepare("select job_id,request_hash,task_json from production_tasks where job_id=?").get(jobId); }
  finally { db.close(); }
  if (!agent || agent.request_hash !== job.request_hash) die("SEO_CROSS_REPO_TASK_IDENTITY_MISMATCH");
  const task = JSON.parse(agent.task_json);
  if (task.job_id !== jobId || task.request_hash !== job.request_hash
    || task.product_id !== job.product_id || task.action_id !== job.action_id
    || JSON.stringify(stable(task.parameters)) !== JSON.stringify(stable(job.parameters_json))
    || JSON.stringify(stable(task.material_refs)) !== JSON.stringify(stable(job.material_refs_json))) {
    die("SEO_CROSS_REPO_TASK_ENVELOPE_MISMATCH");
  }
  const ref = task.material_refs?.[0], binding = bindings[0];
  const pairs = [["material_id", "material_id"], ["ordinal", "ordinal"], ["role", "role"],
    ["display_name", "display_name"], ["object_ref", "object_ref"], ["sha256", "sha256"],
    ["bytes", "byte_count"], ["media_type", "media_type"], ["storage_class", "storage_class"]];
  if (task.material_refs.length !== 1 || pairs.some(([left, right]) =>
    left === "bytes" ? Number(ref[left]) !== Number(binding[right]) : ref[left] !== binding[right])
    || !binding.material_blob_id || binding.object_ref !== binding.canonical_object_ref
    || binding.sha256 !== binding.blob_sha256 || Number(binding.byte_count) !== Number(binding.blob_byte_count)
    || binding.ordinal !== 0 || binding.media_type !== "application/zip") die("SEO_CROSS_REPO_MATERIAL_MISMATCH");
  const folder = join(resolve(taskRoot), jobId, "materials");
  const names = await readdir(folder, { withFileTypes: true });
  if (names.length !== 1 || !names[0].isFile() || names[0].name !== ref.display_name) {
    die("SEO_AGENT_MATERIAL_SET_MISMATCH");
  }
  const localBytes = await readFile(join(folder, ref.display_name));
  if (localBytes.length !== ref.bytes || sha(localBytes) !== ref.sha256) die("SEO_AGENT_ARCHIVE_BYTES_MISMATCH");
  const { readAiProductionInputObject } = await import(pathToFileURL(join(websiteRoot,
    "services/api/src/ai-production/private-object-store.ts")).href);
  const websiteBytes = Buffer.from(await readAiProductionInputObject({ objectRef: ref.object_ref,
    expectedHash: ref.sha256, expectedBytes: ref.bytes }));
  if (!websiteBytes.equals(localBytes)) die("SEO_WEBSITE_AGENT_ARCHIVE_BYTES_MISMATCH");
  const entries = requireWebsite("fflate").unzipSync(websiteBytes);
  const entryNames = Object.keys(entries).sort();
  const root = "公开知识生产资料/";
  const bookFiles = entryNames.filter((name) => name.startsWith(`${root}01_古籍/`));
  const books = new Map();
  for (const name of bookFiles) {
    const match = /^公开知识生产资料\/01_古籍\/([^/]+)\/(原文\.md|索引\.json)$/u.exec(name);
    if (!match) die("SEO_ARCHIVE_UNEXPECTED_BOOK_ENTRY");
    books.set(match[1], [...(books.get(match[1]) ?? []), match[2]]);
  }
  if (books.size === 0 || [...books.values()].some((parts) =>
    JSON.stringify(parts.sort()) !== JSON.stringify(["原文.md", "索引.json"].sort()))
    || entryNames.length !== books.size * 2 + 2
    || !entryNames.includes(`${root}02_现役文章目录/已接纳文章目录.json`)
    || !entryNames.includes(`${root}03_主题聚类/主题聚类.json`)) die("SEO_ARCHIVE_CONTENT_INCOMPLETE");
  const parsed = Object.fromEntries(entryNames.filter((entry) => entry.endsWith(".json"))
    .map((name) => [name, JSON.parse(Buffer.from(entries[name]).toString("utf8"))]));
  const catalogPath = `${root}02_现役文章目录/已接纳文章目录.json`;
  const clustersPath = `${root}03_主题聚类/主题聚类.json`;
  if (parsed[catalogPath]?.schema_version !== "public-knowledge-admitted-articles.v1"
    || parsed[clustersPath]?.schema_version !== "public-knowledge-topic-clusters.v1"
    || parsed[catalogPath].domain_id !== task.parameters.domain_id
    || parsed[clustersPath].domain_id !== task.parameters.domain_id
    || !Array.isArray(parsed[catalogPath].entries)
    || !Array.isArray(parsed[clustersPath].entries)) die("SEO_ARCHIVE_SEMANTIC_CATALOG_INVALID");
  const catalog = JSON.parse(await readFile(join(resolve(repo),
    "src/lib/local-runtime/production/website-agent-route-policies.v1.json"), "utf8"));
  const routes = catalog.routes.filter((route) => route.product_id === job.product_id
    && route.action_id === job.action_id);
  if (routes.length !== 1) die("SEO_ROUTE_POLICY_AMBIGUOUS");
  const paths = ["src/plugins/public-knowledge-article-pipeline/index.ts",
    "src/plugins/public-knowledge-article-pipeline/seo-turn-prompts.ts",
    "src/plugins/public-knowledge-article-pipeline/seo-turn-contract.ts",
    "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts",
    "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts",
    "src/plugins/public-knowledge-article-pipeline/result-contract.ts",
    "src/capabilities/gpt/contract.ts",
    "src/lib/browser/chrome-extension/dom-semantic-text.ts",
    "src/lib/local-runtime/production/website-agent-route-policies.v1.json"];
  const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async (path) =>
    [path, sha(await readFile(join(resolve(repo), path)))])));
  if (Object.entries(freezeSeoFlow().productSourceHashes).some(([path, hash]) =>
    sourceHashes[path] !== hash)) die("SEO_PRODUCT_FLOW_PROJECTION_DRIFT");
  const profileSource = await readFile(join(resolve(repo),
    "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts"), "utf8");
  const modelNames = [...profileSource.matchAll(/startModelDisplayName:\s*"([^"]+)"/gu)];
  const reasoningValues = [...profileSource.matchAll(/requestedReasoningValue:\s*([1-9][0-9]*)/gu)];
  if (modelNames.length !== 1 || reasoningValues.length !== 1) die("SEO_EXECUTION_PROFILE_SOURCE_AMBIGUOUS");
  const executionProfile = { startModelDisplayName: modelNames[0][1],
    requestedReasoningValue: Number(reasoningValues[0][1]) };
  const result = { task, route: routes[0], archiveBytes: websiteBytes,
    publicSource: { sourceKind: "LIVE_SEO_CAPTURE_SESSION_INPUT", productId: job.product_id,
      actionId: job.action_id, jobIdHash: sha(jobId), requestHash: job.request_hash,
      taskEnvelopeHash: sha(agent.task_json), archiveHash: ref.sha256, archiveBytes: ref.bytes,
      archiveEntries: entryNames.map((name) => ({ pathHash: sha(name), bytes: entries[name].length,
      sha256: sha(Buffer.from(entries[name])) })), sourceHashes, executionProfile } };
  admitted.add(result);
  return result;
}
